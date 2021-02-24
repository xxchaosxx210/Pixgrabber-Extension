chrome.runtime.onInstalled.addListener(onInstall);

function onInstall(){
    chrome.storage.sync.set({host: "localhost", port: 5000, path: "/set-html"}, function(){
        console.log("Host, Port and Path is set");
    });
}

function todoCallback(jstring){
    window.alert(jstring);
}

chrome.browserAction.onClicked.addListener(function(tab){
    chrome.tabs.sendMessage(tab.id, {text: "report_back"}, todoCallback);
});