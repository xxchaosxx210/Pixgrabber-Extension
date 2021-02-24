const DIV_CLASSNAME = "pixgrabber_holder";
const CHK_CLASSNAME = "pixgrabber_checkbox";

function createThumbnailGroups(){
    groups = [];
    group = [];
    for(let element of document.getElementsByTagName("a")){
        if(element.tagName == "A"){
            if((element.hasChildNodes()) && element.firstChild.tagName == "IMG"){
                if(group.length == 0){
                    // create new div tag
                    div = document.createElement("div");
                    div.className = DIV_CLASSNAME;
                }
                parent = element.parentNode;
                parent.replaceChild(div, element);
                div.appendChild(element);
                group.push([element, element.firstChild]);
            }
            else{
                if(group.length > 0){
                    // add checkbox to end of div
                    var chk = document.createElement("input");
                    chk.setAttribute("type", "checkbox");
                    chk.className = CHK_CLASSNAME;
                    div.appendChild(chk);
                    groups.push(group);
                    group = [];
                }
            }
        }
    }
}

function getSelected(){
    selected = []
    for(let div of document.getElementsByClassName(DIV_CLASSNAME)){
        let chks = div.getElementsByClassName(CHK_CLASSNAME);
        if(chks){
            let checkbox = chks[0];
            if(checkbox.checked){
                for(let a of div.getElementsByTagName("a")){
                    selected.push({"href": a.href, "src": a.firstChild.src});
                }
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