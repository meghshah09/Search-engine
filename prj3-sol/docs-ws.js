'use strict';

const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const process = require('process');
const url = require('url');
const queryString = require('querystring');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;


//Main URLs
const DOCS = '/docs';
const COMPLETIONS = '/completions';

//Default value for count parameter
const COUNT = 5;

/** Listen on port for incoming requests.  Use docFinder instance
 *  of DocFinder to access document collection methods.
 */
function serve(port, docFinder) {
  const app = express();
  app.locals.port = port;
  app.locals.finder = docFinder;
  setupRoutes(app);
  const server = app.listen(port, async function() {
    console.log(`PID ${process.pid} listening on port ${port}`);
  });
  return server;
}

module.exports = { serve };

function setupRoutes(app) {
  //const base = "http://localhost:"+app.locals.port+DOCS;
  //console.log(base);
  app.use(cors());            //for security workaround in future projects
  app.use(bodyParser.json()); //all incoming bodies are JSON

  //@TODO: add routes for required 4 services
  app.get(`${DOCS}/:name`, getContent(app));
  app.post(`${DOCS}`, addContent(app));
  app.get(`${DOCS}`, doSearch(app));
  app.get(`${COMPLETIONS}`, getCompletions(app));
  app.use(doErrors()); //must be last; setup for server errors   
}

//@TODO: add handler creation functions called by route setup
//routine for each individual web service.  Note that each
//returned handler should be wrapped using errorWrap() to
//ensure that any internal errors are handled reasonably.

function getContent(app){
  return errorWrap(async function(req,res){
    try{
     const name = req.params.name;
     //console.log(name);
     const results = await app.locals.finder.docContent(name);
     //console.log(results);
     const link = DOCS+"/"+name;
      const obj={
        "content":results,
        "links":[{
          "rel":"self",
          "href": baseUrl(req,link)
        }]
      }
      res.json(obj);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function addContent(app){
  return errorWrap(async function(req,res){
    try{
      let name = req.body.name;
      let content = req.body.content;
      //console.log(name);
      if(!name){
        throw{
        "code": "BAD_PARAM",
        "message": "Request body is incorrect. 'name' property might be missing or it's incorrect"
        }
      }
      else if(!content){
        throw{
        "code": "BAD_PARAM",
        "message": "Request body is incorrect. 'content' property might be missing or it's incorrect"
        }
      }
      const results = await app.locals.finder.addContent(name,content);
      const link = DOCS+"/"+name;
      let obj = {
        "href": baseUrl(req,link)
      }
      res.status(CREATED).json(obj);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }


  });
}

function doSearch(app){
  return errorWrap(async function(req,res){
    try{
      const q= req.query.q;
      let count= req.query.count || 5;
      let start = req.query.start || 0;
      if(!q){
        throw{
        "code": "BAD_PARAM",
        "message": "query parameter 'q' might be missing or incorrect"
        }
      }
      else if (!(count >=0)){
        throw{
        "code": "BAD_PARAM",
        "message": "query parameter 'count' might be missing or incorrect"
        }
      }
      else if(!(start >=0)){
        throw{
        "code": "BAD_PARAM",
        "message": "query parameter 'start' might be missing or incorrect"
        }
      }
      const results = await app.locals.finder.find(q);
      results.forEach(function(obj){
        const link= DOCS+"/"+obj.name;
        obj.href = baseUrl(req,link);
      });
      start = Number(start);
      count = Number(count);
      let end = /*((start + count) > results.length ) ? -1 : */(start+count);
      //console.log(typeof start);
      const truncateResult = (end === -1) ? results.slice(start) : results.slice(start,end);
      let link =[];
      let l = encodeURI(DOCS+"?q="+q+"&start="+start+"&count="+count);
      let l1={
        "rel":"self",
        "href": baseUrl(req,l)
      }
      link.push(l1);
      if(start+count < results.length){
        const remain = (results.length-end < count)?results.length-end:count;
        l = encodeURI(DOCS+"?q="+q+"&start="+end+"&count="+remain);
        l1={
        "rel":"next",
        "href": baseUrl(req,l)
        }
        link.push(l1);
      }
      if(end-count>0){
        const n = start-count;
        
        l = encodeURI(DOCS+"?q="+q+"&start="+n+"&count="+count);
        l1={
        "rel":"previous",
        "href": baseUrl(req,l)
        }
        link.push(l1);
      }
      let obj = {
        "results": truncateResult,
        "totalCount":results.length,
        "links":link
      }

      res.json(obj);

    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });

}



function getCompletions(app){
  return errorWrap(async function(req,res){
    try{
    const text = req.query.text;
    if(text){
      const results = await app.locals.finder.complete(text);
      res.json(results);
    }
    else{
      throw{
        "code": "BAD_PARAM",
        "message": "required query parameter 'text' is missing"
      }
    }
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }

  })
}
/** Return error handler which ensures a server error results in nice
 *  JSON sent back to client with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}
  

/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return ({ status: (ERROR_MAP[err.code] || BAD_REQUEST),
  code: err.code,
  message: err.message
      });
}   

/** Return base URL of req for path.
 *  Useful for building links; Example call: baseUrl(req, DOCS)
 */
function baseUrl(req, path='/') {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${path}`;
  return url;
}
