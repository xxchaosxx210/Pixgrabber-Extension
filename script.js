// function getThumbnailsFromPage(){
//     links = []
//     // find thumbnail images
//     var alist = document.getElementsByTagName("a");
//     for(aindex=0;aindex<alist.length;aindex++){
//         atag = alist[aindex];
//         if(atag.hasChildNodes()){
//             if(atag.firstChild.tagName == "IMG"){
//                 links.push({"href": atag.href, "src": atag.firstChild.src});
//             }
//         }
//     }
//     return links
// }
// window.addEventListener("load", function(event){
//     window.alert("window loaded");
//     l = getThumbnailsFromPage();
//     document.dispatchEvent(new CustomEvent("RW759_connectExtension",
//     {links: JSON.stringify(l)}));
// });

// setTimeout(function(){
//     l = getThumbnailsFromPage();
//     document.dispatchEvent(new CustomEvent("RW759_connectExtension",
//     {links: JSON.stringify(l)}));
// }, 0);