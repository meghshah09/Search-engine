<!DOCTYPE html>
<html>
  <head>
    <title>{{name}}</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    {{#errors}}
    <ul>
      <li class="error">{{.}}</li>
    </ul>
    {{/errors}}
    <h1 class="doc-name">{{name}}</h1>
    <pre class="content">{{content}}</pre>
    {{>footer}}
  </body>
</html>