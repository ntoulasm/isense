// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=397704
// To debug code on page load in cordova-simulate or on Android devices/emulators: launch your app, set breakpoints, 
// and then run "window.location.reload()" in the JavaScript Console.

"use strict";

function IndexPage(){
//       ^hover
    
    var redirects = ['campaign','selectLevel','achievements','statistics'];
//      ^hover
    var footerItems = ['sound'];

    function eventListeners() {
        document.getElementById('appName').style.backgroundImage = "url('" + getImage("appName") + "')";


        for(var item in redirects){
            document.getElementById(redirects[item]).addEventListener("click", function (e) {
                page.pageSwap(e.target.id);
                return;
            });
        }

        document.getElementById('optionsButton').addEventListener("click", function () {
            if (document.getElementById('footer').style.width == '0px') {
                document.getElementById('footer').style.width = '80%';
            } else {
                document.getElementById('footer').style.width = '0';
            }
        });

        if (localStorage.getItem("sound_opt") === "On") document.getElementById('soundButton').style.backgroundImage = 'url("./images/soundOn.png")';
        else document.getElementById('soundButton').style.backgroundImage = 'url("./images/soundOff.png")';

        document.getElementById('soundButton').addEventListener("click", function () {
            var element = document.getElementById('soundButton');
            if (localStorage.getItem("sound_opt") === "On") {
                element.style.backgroundImage = 'url("./images/soundOff.png")';
                localStorage.setItem("sound_opt", "Off");
            } else {
                element.style.backgroundImage = 'url("./images/soundOn.png")';
                localStorage.setItem("sound_opt", "On");
                //mediaPlay(getSound("bell")).play();
            }
        });
    }

    function builderUI(){
        var pageWrapper = document.createElement('div');
        addIDToElement('pageWrapper',pageWrapper);

        var appName = document.createElement('div');
        appName.setAttribute('id','appName');
        pageWrapper.appendChild(appName);

        var mainMenu = document.createElement('div');
        addClassToElement('unselectable',mainMenu);
        addIDToElement('mainMenu', mainMenu);

        for(var item in redirects){
            var but = document.createElement('button');
            addIDToElement(redirects[item],but);
            but.style.backgroundImage = "url('" + getImage("start-"+redirects[item]) + "')";
            mainMenu.appendChild(but);
        }
        pageWrapper.appendChild(mainMenu);

        var optionsButton = document.createElement('button');
        addIDToElement('optionsButton',optionsButton);
        pageWrapper.appendChild(optionsButton);

        var footer = document.createElement('div');
        addIDToElement('footer',footer);

        for(var item in footerItems){
            var but = document.createElement('button');
            addIDToElement(footerItems[item]+'Button',but);
            addClassToElement("index_footerItem",but);
            footer.appendChild(but);
        }
        pageWrapper.appendChild(footer);
        
        document.body.appendChild(pageWrapper);
        eventListeners();
    }

    function destructorUI(){
        document.getElementById('pageWrapper').remove();
    }

    return {
        builderUI,
        destructorUI
    }
}

function Page(){
    var currPage = new IndexPage();
    function installPages(){
        for(var scr in translator.requiredScripts){
            var scriptElem = document.createElement('script');
            scriptElem.setAttribute('type','text/javascript');
            scriptElem.setAttribute('src', translator.requiredScripts[scr]);
            document.body.appendChild(scriptElem);
        }
        for(var css in translator.requiredCSS){
            var cssElem = document.createElement('link');
            cssElem.setAttribute('rel','stylesheet');
            cssElem.setAttribute('type','text/css');
            cssElem.setAttribute('href', translator.requiredCSS[css]);
            document.head.appendChild(cssElem);
        }
    }

    function onDeviceReady(){
        installPages();
        document.addEventListener('pause', onPause.bind(this), false);
        document.addEventListener('resume', onResume.bind(this), false);
        
        preLoad(builderUI,false);
    };

    function onPause() {
        console.log("INDEX PAGE pause");
        // TODO: This application has been suspended. Save application state here.
    };

    function onResume() {
        console.log("INDEX PAGE resume");
        // TODO: This application has been reactivated. Restore application state here.
    };

    function builderUI(){
        currPage.builderUI();
    }

    function destructorUI(){
        currPage.destructorUI();
    }

    function pageSwap(where){
        destructorUI();
        if(where === "index")
            currPage = new IndexPage();
        else if(where === "selectLevel")
            currPage = new SelectLevelPage();
        else if(where === "achievements")
            currPage = new AchievementsPage();
        else if(where === "statistics")
            currPage = new StatisticsPage();
        else if(where === "memoryGame")
            currPage = new MemoryGame();
        else if(where === "reflexGame")
            currPage = new ReflexGame();
        else if(where === "clickGame")
            currPage = new ClickGame();
        else if(where === "matchingGame")
            currPage = new MatchingGame();
        else 
            currPage = new IndexPage();
        builderUI();
    }

    return {
        onDeviceReady,
        pageSwap
    }

}

var page = new Page();
//  ^hover
//  ^def
document.addEventListener('deviceready', page.onDeviceReady, false);