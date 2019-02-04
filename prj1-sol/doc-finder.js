const {inspect} = require('util'); //for debugging

'use strict';

class DocFinder {
	
  /** Constructor for instance of DocFinder. */
  constructor() {
    //@TODO
    this.indexes = new Map(); // with offset and non-normalized
    this.noise = new Set(); // noise words set 
    this.document = new Map(); // normalized document word
    this.fileName = []; //data structure for storing file name.
    this.count= new Map(); //count of the each word repeating in the document.
    this.fileContent = new Map(); // saves the content of the file for lookup.
  }

  /** Return array of non-noise normalized words from string content.
   *  Non-noise means it is not a word in the noiseWords which have
   *  been added to this object.  Normalized means that words are
   *  lower-cased, have been stemmed and all non-alphabetic characters
   *  matching regex [^a-z] have been removed.
   */
  words(content) {
    //@TODO
    //console.log(content);
    let normalized = []
    let noise_words = new Set();
    noise_words = this.noise;
    let res = content.split(/\s+/);
    let res2 = res.map((w) => normalize(w));
    normalized = res2.filter((w) => !(noise_words.has(w)))
    
 
    return normalized;
  }  
  /**Helper class for words() function.
   * returns the list of pairs in [words, offset] in a
   * form of array.
   */
   _wordsLow(content){
   	let match;
   	let indexMapping =[];
   	while(match = WORD_REGEX.exec(content)){
   		const [word,offset] = [match[0], match.index];
   		let NWord = normalize(word).toString();
   		indexMapping.push(NWord,offset);

   	}
   	return indexMapping;
   }

  /** Add all normalized words in noiseWords string to this as
   *  noise words. 
   */
  addNoiseWords(noiseWords) {
    //@TODO
    let noise_words = new Set();
    let res = noiseWords.split(/\s+/);
    res.forEach(function(element){
    	noise_words.add(element);
    });
    this.noise = noise_words;
    //console.log(this.noise); 
    		      			    
  }
  
  /** Add document named by string name with specified content to this
   *  instance. Update index in this with all non-noise normalized
   *  words in content string.
   */ 
  addContent(name, content) {
    //@TODO	  
    let jep = this._wordsLow(content); // non-normalized
    let itr = this.words(content); // content files
    this.document.set(name,itr); // normalized words
   	this.indexes.set(name,jep); // words with offset
    this.fileName.push(name); // file name
    this.count.set(name,worCountMapping(itr));
   	this.fileContent.set(name,content);
  }

 
  /** Given a list of normalized, non-noise words search terms, 
   *  return a list of Result's  which specify the matching documents.  
   *  Each Result object contains the following properties:
   *     name:  the name of the document.
   *     score: the total number of occurrences of the search terms in the
   *            document.
   *     lines: A string consisting the lines containing the earliest
   *            occurrence of the search terms within the document.  Note
   *            that if a line contains multiple search terms, then it will
   *            occur only once in lines.
   *  The Result's list must be sorted in non-ascending order by score.
   *  Results which have the same score are sorted by the document name
   *  in lexicographical ascending order.
   *
   */
  find(terms) {
    //@TODO
    //console.log(this.fileName);
    //console.log(this.count)
    let result =[];
    let scores = this.count;
    let d= this.document;
    let contentArray = this.fileContent;
    //console.log(content);
    let values = this.indexes;

   this.fileName.forEach(function(file,index){
    	let content  = d.get(file);
    	//console.log(content)
    	let TotalScore = 0;
    	let completeLine ='';
    	terms.forEach(function(term){
    		if(content.includes(term)){
    			//console.log(file);
    			let offset = values.get(file);
    			let index = offset.indexOf(term);
    			let v = scores.get(file);
    			let j = contentArray.get(file);
    			//console.log("Score of "+ term +" is " +v[term]);
    			let line = findLine(j,offset[index+1]);
    			//console.log(line);
    			TotalScore = TotalScore + v[term];
    			if(completeLine !== line+"\n")
    				completeLine = completeLine + line +"\n";
    			
    		}
    		else{
    			//No match in this document
    			//console.log(false);
    		}
    	});
    	if(TotalScore !=0){
    		const r1 = new Result(file,TotalScore, completeLine);
    		result.push(r1);
    	}
    });
    result = result.sort(compareResults);

    return result;
  }
	
  /** Given a text string, return a ordered list of all completions of
   *  the last word in text.  Returns [] if the last char in text is
   *  not alphabetic.
   */
  complete(text) {
    //@TODO
    let map = this.document;
    let result = [];
    map.forEach(function(value){
    	value.filter(word => word.includes(text)).forEach(function(element){
    		result.push(element);
    	})
    })
    return result.filter((word,pos) => result.indexOf(word) == pos );
  }

  
} //class DocFinder

module.exports = DocFinder;

/** Regex used for extracting words as maximal non-space sequences. */
const WORD_REGEX = /\S+/g;

/** A simple class which packages together the result for a 
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
/** Counting the Score of each search terms in a normalized array. 
*/
function worCountMapping(wordArray){
	let word = {}
	wordArray.forEach(function(element){
		if(word.hasOwnProperty(element)) word[element]++;
		else word[element] = 1;
	});
	return word;
}
/* Based on the input and the content of the file, this helper
*  function gives the first line of the word appearing in it.
*/
function findLine(content, offset){
	let str1 = content.slice(0,offset)// after matching word
	let str2 = content.slice(offset)// before offset word
	return  str1.split("\n").pop().concat(str2.split("\n")[0]);
}

