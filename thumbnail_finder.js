function getThumbnailsFromPage(){
    links = []
    // find thumbnail images
    var alist = document.getElementsByTagName("a");
    for(aindex=0;aindex<alist.length;aindex++){
        atag = alist[aindex];
        if(atag.hasChildNodes()){
            if(atag.firstChild.tagName == "IMG"){
                links.push({"href": atag.href, "src": atag.firstChild.src});
            }
        }
    }
    return links
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
    if(msg.text == "report_back"){
        var links = getThumbnailsFromPage()
        var j = {"links": links, "title": document.title, "url": window.location.href};
        sendResponse(JSON.stringify(j));
        port.postMessage(JSON.stringify(j));
    }
});