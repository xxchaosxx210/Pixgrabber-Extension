function createThumbnailGroups(){
    group = [];
    groups = [];
    for(let element of document.getElementsByTagName("A")){
        if(element.tagName == "A"){
            if((element.hasChildNodes()) && element.firstChild.tagName == "IMG"){
                if(group.length == 0){
                    // create new div tag
                    // div = document.createElement("div");
                    // div.className = DIV_CLASSNAME;
                    // div.style.border = STYLE_SELECTED_OFF;
                }
                // parent = element.parentNode;
                // parent.replaceChild(div, element);
                // div.appendChild(element);
                // element.addEventListener("click", function(evt){
                //     evt.preventDefault();
                // });
                // div.setAttribute("checked", false);
                // div.addEventListener("click", onDivClick, false);
                group.push({"href": element.href, "src": element.firstChild.src});
            }
            else{
                if(group.length > 0){
                    // var overlay = document.createElement("div");
                    // overlay.className = OVERLAY_CLASSNAME;
                    // div.appendChild(overlay);
                    groups.push(group);
                    group = [];
                }
            }
        }
    }
    groups.push(group);
    return groups;
}

function getThumbnails(){
    thumbs = [];
    for(let atag of document.getElementsByTagName("a")){
        if((atag.hasChildNodes()) && atag.firstChild.tagName == "IMG"){
            thumbs.push({"link": atag.href, "img": atag.firstChild.src});
        }
    }
    return thumbs;
}

function getSelected(){
    selected = []
    for(let div of document.getElementsByClassName(DIV_CLASSNAME)){
        if(div.checked){
            for(let a of div.getElementsByTagName("a")){
                selected.push({"href": a.href, "src": a.firstChild.src});
            }
        }
    }
    return selected;
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
    if(msg.text == "report_back"){
        selected = getSelected();
        var j = {"links": selected, "title": document.title, "url": window.location.href};
        sendResponse(JSON.stringify(thumbs));
    }else if(msg.text == "iframe"){
        var groups = createThumbnailGroups();
        sendResponse({links: groups, "title": document.title});
    }
});

//DOMContentLoaded
window.addEventListener("DOMContentLoaded", function(event){
    var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
    if(!location.ancestorOrigins.contains(extensionOrigin)){
        //createThumbnailGroups();
        var iframe = document.createElement("iframe");
        iframe.id = "pixgrabber_frame";
        iframe.src = chrome.runtime.getURL("frame.html");
        iframe.style.cssText = "background:white;top:0;left:0;width:100%;height:600px;display:block;z-index:1000;";
        let element = document.body.firstChild;
        document.body.insertBefore(iframe, element);
        // var view = document.createElement("div");
        // view.id = "pixgrabber_view";
        // view.style.cssText = "background:white;top:0;left:0;width:100%;height:350px;display:block;overflow:scroll";
        //child = document.body.firstChild;
        //document.body.replaceChild(view, child);
        //view.appendChild(child);

        // for(let group of createThumbnailGroups()){
        //     div = document.createElement("div");
        //     div.className = DIV_CLASSNAME;
        //     div.style.border = STYLE_SELECTED_OFF;
        //     for(let tags of group){
        //         var a = document.createElement("a");
        //         var img = document.createElement("img");
        //         a.href = tags.href;
        //         img.src = tags.src;
        //         a.appendChild(img);
        //         div.appendChild(a);
        //         a.addEventListener("click", function(evt){
        //             evt.preventDefault();
        //         });
        //         div.setAttribute("checked", false);
        //         div.addEventListener("click", onDivClick, false);
        //     }
        //     var overlay = document.createElement("div");
        //     overlay.className = OVERLAY_CLASSNAME;
        //     div.appendChild(overlay);
        //     view.appendChild(div);
        // }
    }
});