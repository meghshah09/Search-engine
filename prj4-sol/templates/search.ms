<!DOCTYPE html>
<html>
  <head>
    <title>Document Collection Search</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1>Documents Collection Search</h1>
    {{#noresult}}<ul>
        <li class="error">{{.}}</li><br>
    </ul>{{/noresult}}
    <form method="GET" action="/docs/search.html">
      <p>
        Please fill in one or more search terms in the field below:
      </p>
      <label>
        <span class="label">Search Terms:</span>
          <input id="query" name="q" value="{{term}}">
      </label>
      <br>
      {{#errors}}
      <span class="error">{{.}}</span><br>{{/errors}}
      <input id="submit" name="submit" type="submit" value="search" class="control">
    </form>
    {{#heading}}<h1>{{.}}</h1>{{/heading}}
    {{#search}}
      {{#result}}
      <p class="result">
        <a class="doc-name" href="{{href}}">{{name}}</a><br>
        {{{line}}}
        <br>
      </p>
      {{/result}}
      {{#link}}
      <a id={{rel}} href="{{href}}">{{name}}</a>
      {{/link}}
    {{/search}}
    {{>footer}}
  </body>
</html>



