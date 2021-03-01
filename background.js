chrome.browserAction.onClicked.addListener(function(tab){
    chrome.tabs.sendMessage(tab.id, {text: "load-frame"}, function(resp){});
});