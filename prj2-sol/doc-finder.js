const assert = require('assert');
const mongo = require('mongodb').MongoClient;

const {inspect} = require('util'); //for debugging

'use strict';

/** This class is expected to persist its state.  Hence when the
 *  class is created with a specific database url, it is expected
 *  to retain the state it had when it was last used with that URL.
 */ 
class DocFinder {

  /** Constructor for instance of DocFinder. The dbUrl is
   *  expected to be of the form mongodb://SERVER:PORT/DB
   *  where SERVER/PORT specifies the server and port on
   *  which the mongo database server is running and DB is
   *  name of the database within that database server which
   *  hosts the persistent content provided by this class.
   */
  constructor(dbUrl) {
    //TODO
    this.url = dbUrl;
    this.dbName = dbUrl.substring(dbUrl.lastIndexOf("/")+1);
    this.noiseWords = new Set();
    this.indexStructure = new Map();
    
  }

  /** This routine is used for all asynchronous initialization
   *  for instance of DocFinder.  It must be called by a client
   *  immediately after creating a new instance of this.
   */
  async init() {
    //TODO
    //console.log(this.dbName)
    const name = this.dbName;
    // Use connect method to connect to the server
    this.client = await mongo.connect(this.url, MONGO_OPTIONS);
    this.db = this.client.db(this.dbName);
    this.collection = this.db.collection("documents");
    this.indexes = this.db.collection("indexing");
    this.counts = this.db.collection("count");
    this.noiseWordCollection = this.db.collection("noiseWord");
    this.fileNameCollection = this.db.collection("file");
  }

  /** Release all resources held by this doc-finder.  Specifically,
   *  close any database connections.
   */
  async close() {
    //TODO
    await this.client.close();
  }

  /** Clear database */
  async clear() {
    //TODO
      await this.db.dropDatabase();
    //console.log('clearing');
  }

  /** Return an array of non-noise normalized words from string
   *  contentText.  Non-noise means it is not a word in the noiseWords
   *  which have been added to this object.  Normalized means that
   *  words are lower-cased, have been stemmed and all non-alphabetic
   *  characters matching regex [^a-z] have been removed.
   */
  async words(contentText) {
    //TODO
      return await this._wordsLow(contentText).map((pair) => pair[0]);
  }

  /* Helper method to normalize the content of the file
  and return the array of the normalize word which excludes noise words.
  */
  _wordsLow(content){
      const words = [];
      //let a = this.noiseWordCollection()
      //console.log(this.noiseWords)
      let match;
      while(match = WORD_REGEX.exec(content)){
          const word = normalize(match[0]);
          if(word && !this.noiseWords.has(word)){
              words.push([word,match.index]);
          }
      }
      return words;
  }

  /** Add all normalized words in the noiseText string to this as
   *  noise words.  This operation should be idempotent.
   */
  async addNoiseWords(noiseText) {
    const noiseWordArray = await this.words(noiseText);
    for (let i  in noiseWordArray){
        this.noiseWords.add(noiseWordArray[i]);
        try{
          this.noiseWordCollection.updateOne({_id:i},{$set:{item:noiseWordArray[i]}},{upsert:true});
        }
        catch(err){
          console.error("noise words not inserted properly");
        }
    }
    //console.log(this.noiseWords);
    
  }

  /** Add document named by string name with specified content string
   *  contentText to this instance. Update index in this with all
   *  non-noise normalized words in contentText string.
   *  This operation should be idempotent.
   */ 
  async addContent(name, contentText) {
    //console.log(contentText);
    //TODO
    if(this.noiseWords.size ==0){
      let a = await this.noiseWordCollection.find().toArray();
      for(let i in a){
        this.noiseWords.add(a[i].item);
      }
    }
    try {
        const newVar = await this.collection.updateOne({_id:name},{$set:{content: contentText}},{upsert:true});
    }catch(e){
        console.error("Could not add the content to the file");
    }
    //this.fileName.push(name);
    const arr = this._wordsLow(contentText);

   for(const pair in arr) {
        const [word, offset] = arr[pair];
        
        let wordIndex = this.indexStructure.get(word);
        if (!wordIndex) this.indexStructure.set(word, wordIndex = new Map());
        let wordInfo = wordIndex.get(name);
        if (!wordInfo) wordIndex.set(name, wordInfo = [0, offset]);
        wordInfo[0]++;
        try{
          await this.indexes.updateOne({_id:word},{$set:wordIndex},{upsert:true});
        }
        catch(err){
          console.error("Could not add details for ${_id}".replace("${_id}",word));
        }
    }
   //await this._countWords(name);
  }

  /** Return contents of document name.  If not found, throw an Error
   *  object with property code set to 'NOT_FOUND' and property
   *  message set to `doc ${name} not found`.
   */
  async docContent(name) {
    //TODO
    let ret = ''
    try{
      const content = await this.collection.find({_id:name},{_id:0}).toArray();
      ret= content[0].content;
    }
    catch(err){
      const obj ={};
      obj.message = 'File name : ${name} could not be found in the database'.replace("${name}",name);
      obj.code = "NOT_FOUND";
      throw obj;
    } 
    return ret;
  }

  /** Given a list of normalized, non-noise words search terms, 
   *  return a list of Result's  which specify the matching documents.  
   *  Each Result object contains the following properties:
   *
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  The 
   *            lines must have the same relative order as in the source
   *            document.  Note that if a line contains multiple search 
   *            terms, then it will occur only once in lines.
   *
   *  The returned Result list must be sorted in non-ascending order
   *  by score.  Results which have the same score are sorted by the
   *  document name in lexicographical ascending order.
   *
   */
  async find(terms) {
    //TODO
    let result =[];
    let arr1= [];
    let file = await this.collection.find().toArray();
    for(const i in file){
      arr1[file[i]._id] = file[i].content;
    }
    let m = new Map();
    for(const i in terms){
      let document = await this.indexes.find({_id:terms[i]},{_id: 0}).toArray();
      let TotalScore = 0;
      let completeLine ='';
      for(const [key,value] of Object.entries(document[0])){
        if(key == '_id')
          continue;

        let line = findLine(arr1[key],value[1]);

        if(m.has(key)){
          let arr = m.get(key);
          arr[0] = arr[0] +value[0];
          if(!(arr[1] === line+"\n")){
            arr[1] = arr[1]+line+"\n";
          }
        }
        else{
          const[v,v1]=[value[0],line+"\n"]
          m.set(key,[v,v1]);
        }
        
      }

       
    }
    //console.log(m)
    //const r1 = new Result(key,value[0], line+"\n");
        //result.push(r1);
        result = this._matchDocs(m);
    result = result.sort(compareResults);

    return result;
      }

/* Helper function to match the file and search term and save the 
* result in an aggregate form of the score. Function takes a map and gives
* back the array which contains result object.
*/
  _matchDocs(m){
    let r =[]
      m.forEach(function(value,key){
        const r1 = new Result(key,value[0],value[1]);
        r.push(r1);
      });
      return r;
  }

  /** Given a text string, return a ordered list of all completions of
   *  the last normalized word in text.  Returns [] if the last char
   *  in text is not alphabetic.
   */
  async complete(text) {
    //TODO
    let document = await this.indexes.find({_id:{$regex:text}}).toArray();
    let result = [];
    for(const i in document){
        let value = document[i]._id;
        if(value.includes(text)){
            result.push(value);
        }

    }
    return result.sort(compareCompleteResults).filter((word,pos) => result.indexOf(word) == pos );
  }

  //Add private methods as necessary
  Error(code,msg){
    let obj ={};
    obj.code = code;
    obj.messgae = msg;
    return obj;
  }

} //class DocFinder

module.exports = DocFinder;

//Add module global functions, constants classes as necessary
//(inaccessible to the rest of the program).

//Used to prevent warning messages from mongodb.
const MONGO_OPTIONS = {
  useNewUrlParser: true
};

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple utility class which packages together the result for a
 *  document search as documented above in DocFinder.find().
 */ 
class Result {
  constructor(name, score, lines) {
    this.name = name; this.score = score; this.lines = lines;
  }

  toString() { return `${this.name}: ${this.score}\n${this.lines}`; }
}

/** Compare result1 with result2: higher scores compare lower; if
 *  scores are equal, then lexicographically earlier names compare
 *  lower.
 */
function compareResults(result1, result2) {
  return (result2.score - result1.score) ||
    result1.name.localeCompare(result2.name);
}

/** Compare complete result1 with result2: lexicographically earlier names compare
 *  lower. Tthis helper function is called by the complte function to lexicographically
 *  sort the result obtain by the complete result.
 */
function compareCompleteResults(result1, result2) {
  return result1.localeCompare(result2);
}

/** Normalize word by stem'ing it, removing all non-alphabetic
 *  characters and converting to lowercase.
 */
function normalize(word) {
  return stem(word.toLowerCase()).replace(/[^a-z]/g, '');
}

/** Place-holder for stemming a word before normalization; this
 *  implementation merely removes 's suffixes.
 */
function stem(word) {
  return word.replace(/\'s$/, '');
}

/* Based on the input and the content of the file, this helper
*  function gives the first line of the word appearing in it.
*/
function findLine(content, offset){
  let str1 = content.slice(0,offset)// after matching word
  let str2 = content.slice(offset)// before offset word
  return  str1.split("\n").pop().concat(str2.split("\n")[0]);
}

