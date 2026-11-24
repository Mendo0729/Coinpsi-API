const { getPublishedKnowledgePosts } = require("../services/knowledge.service");

async function listPublishedPosts(req, res) {
  try {
    const posts = await getPublishedKnowledgePosts();

    return res.status(200).json({
      status: "ok",
      count: posts.length,
      posts
    });
  } catch (error) {
    console.error("No fue posible consultar Espacio del Saber:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar Espacio del Saber."
    });
  }
}

module.exports = {
  listPublishedPosts
};

const {listCatalog,findCatalogPost,recordCatalogEvent,listKnowledgeCategories}=require("../repositories/knowledge.repository");
const {normalizeCatalog,normalizeSlug}=require("../validators/knowledge-catalog.validator");
function handleError(res,error) {
  if(error.code==="VALIDATION_ERROR")return res.status(400).json({error:error.code,message:error.message});
  console.error("Knowledge catalog:",error.message);
  return res.status(500).json({error:"INTERNAL_ERROR",message:"No fue posible consultar Espacio del Saber."});
}
function missing(res){return res.status(404).json({error:"KNOWLEDGE_POST_NOT_FOUND"});}
async function catalog(req,res){try{return res.json({status:"ok",...await listCatalog(normalizeCatalog(req.query))});}catch(e){return handleError(res,e);}}
async function categories(req,res){try{return res.json({status:"ok",categories:await listKnowledgeCategories({activeOnly:true})});}catch(e){return handleError(res,e);}}
async function detail(req,res){try{const post=await findCatalogPost(normalizeSlug(req.params.slug));return post?res.json({status:"ok",post}):missing(res);}catch(e){return handleError(res,e);}}
async function view(req,res){try{const row=await recordCatalogEvent(normalizeSlug(req.params.slug),"view");return row?res.status(204).end():missing(res);}catch(e){return handleError(res,e);}}
async function download(req,res){try{
 const slug=normalizeSlug(req.params.slug);
 const post=await findCatalogPost(slug);if(!post)return missing(res);
 const id=post.driveFileId;
 if(!/^[A-Za-z0-9_-]{10,255}$/.test(id))return missing(res);
 const target=new URL("https://drive.google.com/uc");
 target.searchParams.set("export","download");target.searchParams.set("id",id);
 const key=new URL(post.driveUrl).searchParams.get("resourcekey");
 if(key&&/^[A-Za-z0-9_-]{1,255}$/.test(key))target.searchParams.set("resourcekey",key);
 if(!await recordCatalogEvent(slug,"download"))return missing(res);
 res.set("Cache-Control","no-store");return res.redirect(302,target.href);
}catch(e){return handleError(res,e);}}
Object.assign(module.exports,{catalog,categories,detail,view,download});
