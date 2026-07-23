const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const {
  getDriveImageBuffer,
  getDriveImageMetadata,
  getDriveThumbnailBuffer
} = require("./google-drive-gallery.service");

const VARIANTS = Object.freeze({
  thumbnail: {
    width: 480,
    height: 360,
    fit: "cover",
    quality: 68
  },
  medium: {
    width: 1280,
    height: 1280,
    fit: "inside",
    quality: 78
  }
});

const CACHE_ROOT = path.resolve(
  process.cwd(),
  process.env.IMAGE_CACHE_DIR || ".image-cache"
);
const MAX_CONCURRENT_JOBS = normalizeInteger(
  process.env.IMAGE_OPTIMIZATION_CONCURRENCY,
  4,
  1,
  8
);
const SHARP_CONCURRENCY = normalizeInteger(
  process.env.SHARP_CONCURRENCY,
  2,
  1,
  4
);
const MAX_INPUT_PIXELS = normalizeInteger(
  process.env.IMAGE_MAX_INPUT_PIXELS,
  100000000,
  1000000,
  200000000
);

const inFlight = new Map();
const waitingJobs = [];
let activeJobs = 0;

sharp.cache({ files: 20, items: 50, memory: 128 });
sharp.concurrency(SHARP_CONCURRENCY);

function normalizeInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function getVariantConfig(variantName) {
  const config = VARIANTS[variantName];
  if (!config) {
    const error = new Error("La variante de imagen solicitada no es valida.");
    error.code = "IMAGE_VARIANT_INVALID";
    throw error;
  }
  return config;
}

function createCacheKey(metadata, variantName) {
  const version = metadata.md5Checksum || metadata.modifiedTime || metadata.size || "unknown";
  return crypto
    .createHash("sha256")
    .update(`${metadata.id}:${version}:${variantName}:webp-v1`)
    .digest("hex");
}

function getCachePath(variantName, cacheKey) {
  return path.join(CACHE_ROOT, variantName, `${cacheKey}.webp`);
}

async function readCachedBuffer(cachePath) {
  try {
    return await fs.promises.readFile(cachePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeCachedBuffer(cachePath, buffer) {
  await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
  const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryPath, buffer, { mode: 0o600 });
  await fs.promises.rename(temporaryPath, cachePath);
}

function runWithLimit(task) {
  return new Promise((resolve, reject) => {
    waitingJobs.push({ task, resolve, reject });
    drainQueue();
  });
}

function drainQueue() {
  while (activeJobs < MAX_CONCURRENT_JOBS && waitingJobs.length) {
    const job = waitingJobs.shift();
    activeJobs += 1;

    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeJobs -= 1;
        drainQueue();
      });
  }
}

async function getSourceBuffer(metadata, variantName) {
  if (variantName === "thumbnail" && metadata.thumbnailLink) {
    try {
      const thumbnail = await getDriveThumbnailBuffer(metadata);
      if (thumbnail?.buffer?.length) return thumbnail;
    } catch (error) {
      console.warn(
        `No se pudo usar la miniatura de Drive para ${metadata.id}; se usara el original: ${error.message}`
      );
    }
  }

  return getDriveImageBuffer(metadata);
}

async function transformToWebp(sourceBuffer, variantName) {
  const config = getVariantConfig(variantName);
  const resizeOptions = {
    width: config.width,
    height: config.height,
    fit: config.fit,
    withoutEnlargement: true
  };

  if (variantName === "thumbnail") resizeOptions.position = "attention";

  const result = await sharp(sourceBuffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true
  })
    .rotate()
    .resize(resizeOptions)
    .webp({ quality: config.quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    size: result.info.size
  };
}

async function buildOptimizedImage(metadata, variantName, cacheKey, cachePath) {
  const cachedBuffer = await readCachedBuffer(cachePath);
  if (cachedBuffer) {
    return {
      metadata,
      buffer: cachedBuffer,
      mimeType: "image/webp",
      cacheKey,
      cacheStatus: "HIT",
      variant: variantName
    };
  }

  const source = await getSourceBuffer(metadata, variantName);

  try {
    const optimized = await transformToWebp(source.buffer, variantName);
    await writeCachedBuffer(cachePath, optimized.buffer);

    return {
      metadata,
      ...optimized,
      mimeType: "image/webp",
      cacheKey,
      cacheStatus: "MISS",
      variant: variantName
    };
  } catch (error) {
    console.error(
      `No fue posible optimizar la imagen ${metadata.id}; se entregara el archivo original: ${error.message}`
    );

    return {
      metadata,
      buffer: source.buffer,
      mimeType: source.mimeType || metadata.mimeType,
      size: source.buffer.length,
      cacheKey,
      cacheStatus: "BYPASS",
      variant: "original"
    };
  }
}

async function getOptimizedDriveImage(fileId, variantName) {
  getVariantConfig(variantName);
  const metadata = await getDriveImageMetadata(fileId);
  const cacheKey = createCacheKey(metadata, variantName);
  const cachePath = getCachePath(variantName, cacheKey);
  const cachedBuffer = await readCachedBuffer(cachePath);

  if (cachedBuffer) {
    return {
      metadata,
      buffer: cachedBuffer,
      mimeType: "image/webp",
      size: cachedBuffer.length,
      cacheKey,
      cacheStatus: "HIT",
      variant: variantName
    };
  }

  const inFlightKey = `${variantName}:${cacheKey}`;
  if (inFlight.has(inFlightKey)) return inFlight.get(inFlightKey);

  const promise = runWithLimit(() =>
    buildOptimizedImage(metadata, variantName, cacheKey, cachePath)
  ).finally(() => {
    inFlight.delete(inFlightKey);
  });

  inFlight.set(inFlightKey, promise);
  return promise;
}

module.exports = {
  getOptimizedDriveImage
};
