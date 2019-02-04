'use strict';

const express = require('express');
const upload = require('multer')();
const fs = require('fs');
const mustache = require('mustache');
const Path = require('path');
const { URL } = require('url');
const querystring = require('querystring');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

function serve(port, base, model) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.model = model;
  process.chdir(__dirname);
  app.use(base, express.static(STATIC_DIR));
  setupTemplates(app, TEMPLATES_DIR);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


module.exports = serve;

/******************************** Routes *******************************/

function setupRoutes(app) {
  //@TODO add appropriate routes
  const base = app.locals.base;
  //console.log(base);
  app.get(`${base}/add.html`, addContentForm(app));
  app.get(`${base}/search.html`, searchForm(app));
  app.post(`${base}/add`, upload.single('file'),addContent(app));
  app.get(`${base}/:name`, getContent(app));
  app.get(`/`,redirectUser(app))// must be last
}

/*************************** Action Routines ***************************/

//@TODO add action routines for routes + any auxiliary functions.
/* Add file form submit method*/
function addContent(app) {
  return async function(req, res) {
    //console.log(req.file);
    const obj={}
      try{
        if(req.file === undefined)
          throw {message:"A file is required to submit the form"};
        const arr = req.file.originalname.split(".");
       
        obj.name= arr[0];
        obj.content = req.file.buffer.toString('utf8');
        await app.locals.model.addContent(obj);

        res.redirect(`${app.locals.base}/${obj.name}`);
      }
      catch(err){
        console.log(err.message);
        const model = errorModel(app,err);
        const html = doMustache(app, 'add', model);
        res.send(html);
      }
  }
}
/* Search form submit method which passes to web service call*/
function searchForm(app) {
  return async function(req, res) {
    const load = (Object.keys(req.query).length == 0)?true:false;
    let model={};
    if(!load){
    const search = getNonEmptyValues(req.query);
    try{
      if(search.q === undefined){
        throw{message:"Please specify atleast one search term"};
      }
      //console.log(req.query.q);
      const query_param = querystring.stringify(search);
      const result = await app.locals.model.search(query_param);
      //const qTerm = search.q.split(" ").join(" ");
      if(result.results.length >0){
        const obj = massageResults(result,req);
        model={base: app.locals.base,term:search.q,heading:["Search Results"],search:obj};
        //console.log(model);
      }
      else{
        model = wsErrors(app,req.query.q,{message:"No search results found for term ' "+search.q+" '"})
      }
    }catch(err){
      model = errorModel(app,err);
    }
  }//end if
  else{
    model={base: app.locals.base};
  }
  const html = doMustache(app, 'search', model);
  res.send(html);
    
  }
}
/* service for displaying the add file form */
function addContentForm(app) {
  return async function(req, res) {
    const model = { base: app.locals.base};
    const html = doMustache(app, 'add', model);
    res.send(html);
  }
}
/*service for displaying the contnet of the file */
function getContent(app) {
  return async function(req, res) {
    const name = req.params.name;
    let model;
    try{
      const content = await app.locals.model.getContent(name);
      model={base:app.locals.base, name:name, content:content.content}
      //console.log(content);
    }
    catch(err){
      //console.log(err);
      model = errorModel(app,err);
    }

    const html = doMustache(app,'document',model);
    res.send(html);
  }
}
/* base function to redirect the user on / */
function redirectUser(app){
  return async function(req,res){
    try{
      res.redirect(`${app.locals.base}/`);
    }
    catch(err){
      console.error(err);

    }
  }
}

/************************ General Utilities ****************************/

/* return object containing all non-empty values from object values */
function getNonEmptyValues(values) {
  const out = {};
  Object.keys(values).forEach(function(k) {
    const v = values[k];
    if (v && v.trim().length > 0) out[k] = v.trim();
  });
  return out;
}
/* helper function for the search result to form the lonks and the model datat in a appropriate manner */
function massageResults(result,req){
 let links =[];
 let results =[];
  links = result.links.filter((u)=> u.rel!== 'self').map((a)=> ({ rel:a.rel,name:capitalizeFirstLetter(a.rel), href: baseUrl(req,'/docs/search.html')+`?q=${req.query.q}&start=${a.start}`}));
  //console.log(links);//relativeUrl(req,'/docs/search.html',req.query)
  links = links.reverse();
  results = result.results.map((u)=> ({name:u.name , line:formation(u.lines[0],req.query.q) , href:baseUrl(req,'/docs/')+u.name }));
  return [{result:results,link:links}];
}
/* helper function of massageResuts for highlighting the character */
function formation(line,queries){
  //console.log(queries)
  const query = queries.toString().split(" ");

  const l = line.split(" ").map((u) => (highlighter(u,query)?stripOff(u): u)).join(" ");
  //console.log(l);
  return l;
}
/* helper function of massageResuts for highlighting the character  and stripping off the punctuation*/
function stripOff(u){

let arr = u.replace(/[^\w\s]|_/g, function ($1) { return ' ' + $1 + ' ';}).replace(/[ ]+/g, ' ').split(' '); // make it in format ["Snark","!","."]
let ar = arr.reduce((acc,cv,ci)=> ((/^[a-zA-z]+$/.test(cv))?acc+`<span class="search-term">${cv}</span>`:acc+cv),''); //use accumlator to accumlate it and make the template as we want <span class="search-term">Snark</span>!.
return ar;
}

function highlighter(u,query){
  for(let q of query){
        //console.log(u +" and query "+q)
        if(q.localeCompare(u.toLowerCase().replace(/[^a-z]/g,'')) === 0)
         return true;
      }
      return false;
}
/* capitalize the the first character for next and Previous Links*/
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
/** Return a URL relative to req.originalUrl.  Returned URL path
 *  determined by path (which is absolute if starting with /). For
 *  example, specifying path as ../search.html will return a URL which
 *  is a sibling of the current document.  Object queryParams are
 *  encoded into the result's query-string and hash is set up as a
 *  fragment identifier for the result.
 */
function relativeUrl(req, path='', queryParams={}, hash='') {
  const url = new URL('http://dummy.com');
  url.protocol = req.protocol;
  url.hostname = req.hostname;
  url.port = req.socket.address().port;
  url.pathname = req.originalUrl.replace(/(\?.*)?$/, '');
  if (path.startsWith('/')) {
    url.pathname = path;
  }
  else if (path) {
    url.pathname += `/${path}`;
  }
  url.search = '';
  Object.entries(queryParams).forEach(([k, v]) => {
    url.searchParams.set(k, v);
  });
  url.hash = hash;
  return url.toString();
}
/** Return base URL of req for path.
 *  Useful for building links; Example call: baseUrl(req, DOCS)
 */
function baseUrl(req, path='/') {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${path}`;
  return url;
}

/** Return a model suitable for mixing into a template */
function errorModel(app, errors={}) {
  return {
    base: app.locals.base,
    errors: [errors.message]
  };
}

/** Decode an error thrown by web services into an errors hash
 *  with a _ key.
 */
function wsErrors(app,term='',err={}) {
  const msg = (err.message) ? err.message : 'web service error';
  console.error(msg);
  return {base: app.locals.base,term:term,noresult: [ msg ] };
}
/************************** Template Utilities *************************/


/** Return result of mixing view-model view into template templateId
 *  in app templates.
 */
function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

/** Add contents all dir/*.ms files to app templates with each 
 *  template being keyed by the basename (sans extensions) of
 *  its file basename.
 */
function setupTemplates(app, dir) {
  app.templates = {};
  for (let fname of fs.readdirSync(dir)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}

