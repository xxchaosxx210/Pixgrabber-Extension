const ERROR_MESSAGE = "Unable to connect to PixGrabber. Make sure you have PixGrabber installed and running. Find it here: https://github.com/xxchaosxx210/wxPixGrabber.git";

chrome.runtime.onInstalled.addListener(onInstall);

function onInstall(){
    chrome.storage.sync.set({host: "localhost", port: 5000, path: "/set-html"}, function(){
        console.log("Host, Port and Path is set");
    });
}

function todoCallback(jstring){
    // if(jstring){
    //     b = btoa(jstring);
    //     xhr = new XMLHttpRequest();
    //     xhr.timeout = 2000;
    //     xhr.open("POST", "http://localhost:5000/set-html", true);
    //     xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    //     xhr.addEventListener("load", function(event){
    //         if(event.response == 200){
    //             console.log("Connected to PixGrabber");
    //         }
    //     });
    //     xhr.addEventListener("error", function(event){
    //         window.alert(ERROR_MESSAGE);
    //     });
    //     xhr.addEventListener("timeout", function(event){
    //         window.alert(ERROR_MESSAGE);
    //     });
    //     xhr.send(b);
    // }
    var j = JSON.parse(jstring);
    console.log(j);
}

chrome.browserAction.onClicked.addListener(function(tab){
    chrome.tabs.sendMessage(tab.id, {text: "report_back"}, todoCallback);
});