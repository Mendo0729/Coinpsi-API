const types=new Set(["research","article","guide","report","journal"]);
function invalid(field){const e=new Error("Parámetro inválido: "+field);e.code="VALIDATION_ERROR";throw e;}
function normalizeCatalog(query={}) {
  function str(k,max){const v=query[k];if(v===undefined)return "";if(typeof v!=="string"||v.length>max)invalid(k);return v.trim();}
  function integer(k,defaultValue,max){const v=str(k,10);if(!v)return defaultValue;if(!/^[1-9]\d*$/.test(v)||Number(v)>max)invalid(k);return Number(v);}
  const search=str("search",180),category=str("category",120),type=str("type",30),sort=str("sort",10)||"newest";
  const year=integer("year",null,9999);
  if(category&&!/^[a-z0-9-]+$/.test(category))invalid("category");
  if(type&&!types.has(type))invalid("type");
  if(year!==null&&year<1000)invalid("year");
  if(!["newest","oldest"].includes(sort))invalid("sort");
  return {search,category,type,sort,year,page:integer("page",1,10000),limit:integer("limit",12,50)};
}
function normalizeSlug(slug){if(typeof slug!=="string"||slug.length>200||!/^[a-z0-9-]+$/.test(slug))invalid("slug");return slug;}
module.exports={normalizeCatalog,normalizeSlug};
