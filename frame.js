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

function onSubmitButton(event){
    selected = getSelected();
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {text: "onsubmit", links: selected}, function(resp){
            
        });
    });
}

function onResponse(json){
    var view = document.createElement("div");
    view.id = "pixgrabber_view";
    document.body.appendChild(view);

    for(let group of json.links){
        div = document.createElement("div");
        div.className = DIV_CLASSNAME;
        div.style.border = STYLE_SELECTED_OFF;
        //div.style.border = STYLE_SELECTED_OFF;
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
    var submit = document.createElement("input");
    submit.type = "button";
    submit.className = "pixgrabber_submit";
    submit.value = "Submit";
    submit.addEventListener("click", onSubmitButton);
    document.body.appendChild(submit);
}

chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
    chrome.tabs.insertCSS(tabs[0].id, {file: "frame.css"});
    chrome.tabs.sendMessage(tabs[0].id, {text: "iframe"}, onResponse);
});