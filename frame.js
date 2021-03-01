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
        overlay = div.getElementsByClassName(OVERLAY_CLASSNAME);
        div.getElementsByClassName(OVERLAY_CLASSNAME)[0].style.display = "block";
    }
    else{
        div.style.border = STYLE_SELECTED_OFF;
        overlay = div.getElementsByClassName(OVERLAY_CLASSNAME);
        div.getElementsByClassName(OVERLAY_CLASSNAME)[0].style.display = "none";
    }
}

function onResponse(json){
    var view = document.createElement("div");
    view.id = "pixgrabber_view";
    view.style.cssText = "background:white;top:0;left:0;width:100%;height:350px;display:block;overflow:scroll";
    document.body.appendChild(view);

    for(let group of json.links){
        div = document.createElement("div");
        div.className = DIV_CLASSNAME;
        div.style.border = STYLE_SELECTED_OFF;
        for(let tags of group){
            var a = document.createElement("a");
            var img = document.createElement("img");
            a.href = tags.href;
            img.src = tags.src;
            a.appendChild(img);
            div.appendChild(a);
            a.addEventListener("click", function(evt){
                evt.preventDefault();
            });
            div.setAttribute("checked", false);
            div.addEventListener("click", onDivClick, false);
        }
        var overlay = document.createElement("div");
        overlay.className = OVERLAY_CLASSNAME;
        div.appendChild(overlay);
        view.appendChild(div);
    }
}

chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
    chrome.tabs.sendMessage(tabs[0].id, {text: "iframe"}, onResponse);
});