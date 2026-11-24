const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizeCatalog,normalizeSlug}=require("../src/validators/knowledge-catalog.validator");
test("catalog defaults and valid filters",()=>{assert.deepEqual(normalizeCatalog(),{search:"",category:"",type:"",sort:"newest",year:null,page:1,limit:12});assert.equal(normalizeCatalog({year:"2026",limit:"50",type:"research"}).year,2026);});
test("reject invalid and oversized parameters",()=>{for(const q of [{limit:"51"},{page:"0"},{page:"1e3"},{search:["a","b"]},{sort:"DESC; DROP"},{type:"x"},{category:"a' OR 1=1"},{year:"99"}])assert.throws(()=>normalizeCatalog(q),{code:"VALIDATION_ERROR"});});
test("slug validation",()=>{assert.equal(normalizeSlug("research-123"),"research-123");assert.throws(()=>normalizeSlug("../draft"),{code:"VALIDATION_ERROR"});});
