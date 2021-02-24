chrome.runtime.onInstalled.addListener(onInstall);

function onInstall(){
    chrome.storage.sync.set({host: "localhost", port: 5000, path: "/set-html"}, function(){
        console.log("Host, Port and Path is set");
    });
}

function todoCallback(jstring){
    if(jstring){
        b = btoa(jstring);
        xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:5000/set-html", true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = function(){
            if(this.readyState == XMLHttpRequest.DONE && this.status == 200){
                console.log("Connected to PixGrabber successful");
            }
            else{
                window.alert("Unable to connect to PixGrabber. Make sure you have PixGrabber installed and running. Find it here: https://github.com/xxchaosxx210/wxPixGrabber.git")
            }
        }
        xhr.send(b);
    }
}

chrome.browserAction.onClicked.addListener(function(tab){
    chrome.tabs.sendMessage(tab.id, {text: "report_back"}, todoCallback);
});