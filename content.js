const ERROR_MESSAGE = "Unable to connect to PixGrabber. Make sure you have PixGrabber installed and running. Find it here: https://github.com/xxchaosxx210/wxPixGrabber.git";

const ID_IFRAME = "pixgrabber-iframe";

function createThumbnailGroups(){
    group = [];
    groups = [];
    for(let element of document.getElementsByTagName("A")){
        if(element.tagName == "A"){
            if((element.hasChildNodes()) && element.firstChild.tagName == "IMG"){
                group.push({"href": element.href, "src": element.firstChild.src});
            }
            else{
                if(group.length > 0){
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


function sendRequest(jstring){
    if(jstring){
        b = btoa(jstring);
        xhr = new XMLHttpRequest();
        xhr.timeout = 2000;
        xhr.open("POST", "http://localhost:5000/set-html", true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.addEventListener("load", function(event){
            if(event.response == 200){
                console.log("Connected to PixGrabber");
            }
        });
        xhr.addEventListener("error", function(event){
            window.alert(ERROR_MESSAGE);
        });
        xhr.addEventListener("timeout", function(event){
            window.alert(ERROR_MESSAGE);
        });
        xhr.send(b);
    }
}


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
    if(msg.text == "load-frame"){
        var iframe = document.getElementById(ID_IFRAME);
        if(!iframe){
            var iframe = document.createElement("iframe");
            iframe.className = "pixgrabber_frame";
            iframe.id = ID_IFRAME;
            iframe.src = chrome.runtime.getURL("frame.html");
            let element = document.body.firstChild;
            document.body.insertBefore(iframe, element);
            sendResponse({status: "created"});
        }
        else{
            document.body.removeChild(iframe);
            sendResponse({status: "deleted"});
        }

    }else if(msg.text == "iframe"){
        var groups = createThumbnailGroups();
        sendResponse({links: groups, "title": document.title});
    }else if(msg.text == "onsubmit"){
        var jstring = JSON.stringify({"links": msg.links, "title": document.title, "url": window.location.href});
        sendResponse({"status": "ok"});
        sendRequest(jstring);
    }
});

//DOMContentLoaded
// window.addEventListener("DOMContentLoaded", function(event){
//     var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
//     if(!location.ancestorOrigins.contains(extensionOrigin)){
//         //createThumbnailGroups();
//         var iframe = document.createElement("iframe");
//         iframe.className = "pixgrabber_frame";
//         iframe.id = "pixgrabber_frame";
//         iframe.src = chrome.runtime.getURL("frame.html");
//         let element = document.body.firstChild;
//         document.body.insertBefore(iframe, element);
//     }
// });