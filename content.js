const DIV_CLASSNAME = "pixgrabber_holder";
const OVERLAY_CLASSNAME = "pixgrabber_overlay";

const STYLE_SELECTED_ON = "10px solid #0033cc";
const STYLE_SELECTED_OFF = "10px solid #324d88";

function onDivClick(event){
    div = event.currentTarget;
    var checked = div.checked;
    console.log("div is set to " + checked);
    div.checked = !checked;
    if(div.checked == true){
        div.style.border = STYLE_SELECTED_ON;
        div.getElementsByClassName(OVERLAY_CLASSNAME)[0].style.display = "block";
    }
    else{
        div.style.border = STYLE_SELECTED_OFF;
        div.getElementsByClassName(OVERLAY_CLASSNAME)[0].style.display = "none";
    }
}

function createThumbnailGroups(){
    group = [];
    for(let element of document.getElementsByTagName("a")){
        if(element.tagName == "A"){
            if((element.hasChildNodes()) && element.firstChild.tagName == "IMG"){
                if(group.length == 0){
                    // create new div tag
                    div = document.createElement("div");
                    div.className = DIV_CLASSNAME;
                    div.style.border = STYLE_SELECTED_OFF;
                }
                parent = element.parentNode;
                parent.replaceChild(div, element);
                div.appendChild(element);
                element.addEventListener("click", function(evt){
                    evt.preventDefault();
                });
                div.setAttribute("checked", false);
                div.addEventListener("click", onDivClick, false);
                group.push([element, element.firstChild]);
            }
            else{
                if(group.length > 0){
                    var overlay = document.createElement("div");
                    overlay.className = OVERLAY_CLASSNAME;
                    div.appendChild(overlay);
                    group = [];
                }
            }
        }
    }
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
        sendResponse(JSON.stringify(j));
    }
});

window.addEventListener("DOMContentLoaded", function(event){
    createThumbnailGroups();
});