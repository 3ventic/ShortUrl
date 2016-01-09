# ShortUrl
For easy use with ShareX

## Installation

- Clone repo
- Copy config.sample.js to config.js
- Edit config.js
- `npm install`
- `node server`

## ShareX example

Edit & import (in whatever order) to ShareX custom uploaders after installing.

```
{
  "Name": "LABEL FOR MENUS",
  "RequestType": "GET",
  "RequestURL": "https://link.example.com/new",
  "FileFormName": "",
  "Arguments": {
    "secret": "super secret passphrase from config.js",
    "target": "%input"
  },
  "Headers": {},
  "ResponseType": "Text",
  "RegexList": [],
  "URL": "$json:short$",
  "ThumbnailURL": "",
  "DeletionURL": ""
}
```
