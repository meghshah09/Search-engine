'use strict';

const axios = require('axios');


function DocsWs(baseUrl) {
  this.docsUrl = `${baseUrl}/docs`;
}

module.exports = DocsWs;

//@TODO add wrappers to call remote web services.

/* Get Content
URL of the form GET /docs/name
*/

DocsWs.prototype.getContent = async function(name){
	try{

		const response = await axios.get(`${this.docsUrl}/${name}`);
		return response.data; 
	}
	catch(err){
		console.error(err);
		throw(err.response && err.response.data) ? err.response.data : err;
	}

}

/* Add Content 
URL of the form POST /docs
*/
DocsWs.prototype.addContent = async function(obj){

	try{
		const response = await axios.post(this.docsUrl,obj);
		return response.data;
	}
	catch(err){
		console.error(err);
		throw(err.response && err.response.data) ? err.response.data : err;
	}
	
}

/*Search Content 
URL of the form GET /docs?QUERY_PARAMS
*/
DocsWs.prototype.search = async function(q){
	try{
		const url = this.docsUrl + ((typeof q === 'undefined') ? '' : `?${q}`); // QUERY_PARAMS is been constructed and appended to the URL localhost:1235/docs?q=....&start=....
    	const response = await axios.get(url);
    	return response.data;
	}
	catch(err){
		console.error(err);
		//console.log("got it")
		throw(err.response && err.response.data) ? err.response.data : err;
	}
	
}
  
