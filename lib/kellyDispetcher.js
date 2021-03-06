// part of KellyFavItems extension
// only background extensions has access to download API, so we create one
// todo рассылать onChanged при обновлении данных если открыто несколько вкладок

// KellyTools.getBrowser().downloads - не поддерживается Edge

var KellyEDispetcher = new Object;
    KellyEDispetcher.eventsAccepted = false;
    KellyEDispetcher.envDir = 'env/';
    KellyEDispetcher.api = KellyTools.getBrowser();
    
    // bg subscriptions to API
    KellyEDispetcher.initEvents = {
        onChanged :  function(downloadDelta) {
            
            // Clean up 
                                 
            if (downloadDelta && downloadDelta.state) {
                
                if (downloadDelta.state.current == "interrupted" || downloadDelta.state.current == "complete") {
                    
                    
                    if (KellyEDispetcher.blobData[downloadDelta.id]) {
                        
                        URL.revokeObjectURL(KellyEDispetcher.blobData[downloadDelta.id]);
                        delete KellyEDispetcher.blobData[downloadDelta.id];
                    }                   
                }
            }
            
            // Notify tabs
            
            KellyEDispetcher.sendNotification({method: "onChanged", downloadDelta : downloadDelta});
        },
    }
    
    // todo - check any way to keep temporary alive connection with tab in [persistent = false] mode
    // currently background process die after ~15sec of wait
    
    KellyEDispetcher.sendNotification = function(data) {
        
        if (!data || !data.method) return;
        
        var query = {};

        if (KellyEDispetcher.api && KellyEDispetcher.api.runtime.getManifest) {
            var query = {url : KellyEDispetcher.api.runtime.getManifest().content_scripts[0].matches};
        }
        
        chrome.tabs.query(query, function(tabs){     
            for (var i=0; i <= tabs.length-1; i++) {
                
                KellyTools.log('send message to tab ' + tabs[i].url + ' method : ' + data.method, 'KellyEDispetcher');
                
                KellyEDispetcher.api.tabs.sendMessage(tabs[i].id, data, function(response) {
                 
                });
            }
            
        });
    }
    
    KellyEDispetcher.blobData = [];
    
    KellyEDispetcher.isDownloadSupported = function() {
    
        if (!KellyEDispetcher.api || typeof KellyEDispetcher.api.downloads == 'undefined') {
            return false;
        }
        
        return true;
    }
    
    KellyEDispetcher.init = function() {
    
        if (this.eventsAccepted) return true;
        
        this.api.runtime.onMessage.addListener(this.onMessage);        
        this.api.downloads.onChanged.addListener( this.initEvents.onChanged );
                
        this.eventsAccepted = true;
        
        return true;
    }
    
    // custom connections posible only by setting up port connection (onConnectExternal \ onMessageExternal)
    
    KellyEDispetcher.onMessage = function(request, sender, callback) {
            
        KellyTools.log(request, 'KellyEDispetcher');    
        KellyTools.log(sender.tab ? " request from content script : " + sender.tab.url : "from the extension", 'KellyEDispetcher');    
    
        var response = {
            
            senderId : 'dispetcher',
            error : '',
            method : request.method,
            
        }
            
        if (request.method == 'downloads.cancel') {        
            
            if (request.downloadId) {
                KellyTools.getBrowser().downloads.cancel(request.downloadId);
            } else {                
                KellyTools.log('Method : ' + request.method + ' : bad request', 'KellyEDispetcher');
                KellyTools.log(request, 'KellyEDispetcher');
            }
                    
        } else if (request.method == 'downloads.download') {
            
            response.downloadId = -1;
        
            var base64toBlob = function(base64Data, contentType) {
                
                contentType = contentType || '';
                var sliceSize = 1024;
                var byteCharacters = atob(base64Data);
                var bytesLength = byteCharacters.length;
                var slicesCount = Math.ceil(bytesLength / sliceSize);
                var byteArrays = new Array(slicesCount);

                for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
                    var begin = sliceIndex * sliceSize;
                    var end = Math.min(begin + sliceSize, bytesLength);

                    var bytes = new Array(end - begin);
                    for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
                        bytes[i] = byteCharacters[offset].charCodeAt(0);
                    }
                    byteArrays[sliceIndex] = new Uint8Array(bytes);
                }
                
                return new Blob(byteArrays, { type: contentType });
            }
            
            if (typeof request.download.url == 'object') {
                
                var mimeType = request.download.url.type;                
                var blob = base64toBlob(request.download.url.base64, mimeType);
                
                request.download.url = URL.createObjectURL(blob);
                request.blob = true;   
                KellyTools.log('array of data recieved | data type ' + mimeType , 'KellyEDispetcher');
            }
            
            KellyTools.getBrowser().downloads.download(request.download, function (downloadId) {
                
                response.downloadId = downloadId;
                
                if (!downloadId || downloadId < 0) {
                    response.downloadId = -1;
                }
                
                if (KellyEDispetcher.api.runtime.lastError) {                    
                    response.error = KellyEDispetcher.api.runtime.lastError.message;
                }
                
                if (request.blob) {                    
                    KellyEDispetcher.blobData[downloadId] = request.download.url;
                }
                
                if (callback) callback(response);
                
            });
            
            
            return true;
            
        } else if (request.method == "isDownloadSupported") {
            
            response.isDownloadSupported =  KellyEDispetcher.isDownloadSupported();
            
        } else if (request.method == "isFilesDownloaded") {
            
            if (!request.filenames || !request.filenames.length) {
                
                response.matchResults = {};
                
            } else {
                
                response.matchResults = [];
                
                var requsetSearch = function(filename) {
                
                    var regExp = KellyTools.folderPatchToRegularExpression(filename);
                    
                    var onSearchResult = function(result) {
                       
                        if (!result || !result.length) {
                            response.matchResults[response.matchResults.length] = {filename : filename};
                        } else {
                            response.matchResults[response.matchResults.length] = {filename : filename, match : result[0]};
                        }
                        
                        if (KellyEDispetcher.api.runtime.lastError) {						
                            response.error = KellyEDispetcher.api.runtime.lastError.message;
                        }
                        
                        if (response.matchResults.length == request.filenames.length && callback) {
                            callback(response);
                        }
                    }
                    
                    chrome.downloads.search({filenameRegex: regExp}, onSearchResult);
                }
                
                // multiple callbacks untested
                
                for (var i = 0; i < request.filenames.length; i++) {
                                        
                    var badExpression = false;
                    
                    try {
                        
                        requsetSearch(request.filenames[i]);
                       
                    } catch (E) {
                        badExpression = true;
                    }
                    
                    if (badExpression) {
                        response.matchResults[response.matchResults.length] = {filename : request.filenames[i]};
                    }               
                }
                
                if (response.matchResults.length == request.filenames.length) {
                
                } else {                
                    return true; // async
                }
            }
               
        } else if (request.method == "getLocalStorageList") {
            
            var prefix = request.prefix;
            var keepPrefix = request.keepPrefix;
            var slist = [];
            
            if (typeof localStorage == 'undefined' || !localStorage.length) {
        
            } else {
            
                for (var i = 0; i < localStorage.length; i++) {
                    if (localStorage.key(i).indexOf(prefix) !== -1) {
                        if (keepPrefix) slist.push(localStorage.key(i));
                        else slist.push(localStorage.key(i).replace(prefix, '')); 
                    }
                }
            }
            
            response.slist = slist;
        
        } else if (request.method == "getLocalStorageItem") {
            
            if (request.dbName) {
                response.item = localStorage.getItem(request.dbName);
            } else response.item = false;
        
        } else if (request.method == "removeLocalStorageItem") {
            
            if (request.dbName) {
                localStorage.removeItem(request.dbName);
            }
        
        } else if (request.method == "setLocalStorageItem") {
            
            if (request.dbName && request.data) {
                try {
                    
                    localStorage.setItem(request.dbName, JSON.stringify(request.data));
                    
                } catch (E) {
                    
                    response.error = E;
                    
                }
            }
        
        } else if (request.method == "setApiStorageItem") {
            
            if (!request.data) {
            
                response.error = 'setApiStorageItem : Data is empty';
                if (callback) callback(response);
                
            } else {
            
                KellyEDispetcher.api.storage.local.set(request.data, function() {
                
                    if (KellyEDispetcher.api.runtime.lastError) {
                        response.error = KellyEDispetcher.api.runtime.lastError.message;
                    } else response.error = false;
                    
                    if (callback) callback(response);
                });
                
                return true; // async mode
            }
            
        } else if (request.method == "removeApiStorageItem") {
            
            if (!request.dbName) {
            
                response.error = 'removeApiStorageItem : dbName is empty';
                if (callback) callback(response);
                
            } else {
            
                KellyEDispetcher.api.storage.local.remove(request.dbName, function() {
                
                    response.error = false;
                    
                    if (KellyEDispetcher.api.runtime.lastError) {
                        
                        response.error = KellyEDispetcher.api.runtime.lastError.message;
                    }
                    
                    if (callback) callback(response);
                });
                
                return true; // async mode
            
            }
            
        } else if (request.method == "getApiStorageItem") {
        
            if (!request.dbName) {
            
                response.error = 'loadApiStorageItem : dbName is empty';
                if (callback) callback(response);
                
            } else {
            
                KellyEDispetcher.api.storage.local.get(request.dbName, function(item) {
                    
                    response.item = item;
                    
                    if (callback) callback(response);
                });	
                
                return true; // async mode
            
            }
            
        } else if (request.method == "getApiStorageItemBytesInUse") {
            
            response.bytes = 0;
            if (!request.dbName) {
            
                response.error = 'getApiStorageItemBytesInUse : dbName is empty';
                if (callback) callback(response);
                
            } else {
            
                KellyEDispetcher.api.storage.local.getBytesInUse(request.dbName, function(bytes){
                    
                    response.bytes = bytes;
                    if (callback) callback(response);
                });
                
                return true; // async mode
            }
                        
        } else if (request.method == "getApiStorageList") {
            
            KellyEDispetcher.api.storage.local.get(null, function(dbs) {
                
                response.slist = [];
                if (dbs) {
                    var names = Object.keys(dbs);

                    for (var i = 0; i < names.length; i++) {
                        if (names[i].indexOf(request.prefix) !== -1) {
                            if (request.keepPrefix) response.slist.push(names[i]);
                            else response.slist.push(names[i].replace(request.prefix, '')); 
                        }
                    }
                }
                
                if (callback) callback(response);
            });
            
            return true; // async mode
         
        // loads selected css items and send an init dispetcher env data
        
        } else if (request.method == 'getCss') {
            
            var loaded = 0;
            
            var answerData = {
                css : '',
                notice : '',
                url : '',
            };
            
            if (request.debug) {
                KellyTools.DEBUG = true;
                KellyTools.log('Tab loaded in debug mode, switch background process debug mode to TRUE', 'KellyEDispetcher')
            }
            
            var onGetResource = function(url, data, notice) {
                
                loaded++;
                
                answerData.url += ',' + url;
                if (notice) {
                    answerData.notice += ',' + notice;
                }
                
                if (data && data !== false) {
                        
                    answerData.css += "\n\r\n\r\n\r" + '/* ' +  url + ' */' + "\n\r\n\r\n\r";
                    answerData.css += data;
                    answerData.css += "\n\r\n\r\n\r" + '/* ' +  url + ' end */' + "\n\r\n\r\n\r";
                    
                } else {
                    answerData.notice += ', ' + url + ' load failed';
                }
                
                if (loaded == request.items.length) {
                
                    if (callback) {
                
                        callback({
                            error : answerData.notice,
                            data : answerData,
                            isDownloadSupported : KellyEDispetcher.isDownloadSupported(),
                        });
                    }
                }
            }
             
            var	onFail = function(url, errorCode, errorText) {
                onGetResource(url, false, 'code : ' + errorCode + ' | ' +errorText); // perhaps bad idea combine different types \ need to check errorCode typeof
            }
            
            var onSuccess = function(data, url) {
                onGetResource(url, data, false);
            }
            
            for (var i = 0; i < request.items.length; i++) {
                
                KellyTools.log(request.items[i], 'KellyEDispetcher');
                
                var css = KellyTools.getBrowser().runtime.getURL(KellyEDispetcher.envDir + 'css/' + request.items[i] + '.css');
       
                if (!css) {
                    onFail('unknown_' + request.items[i], false, 'unexist css file ' + request.items[i]);
                } else {
                
                    KellyTools.readUrl(css, onSuccess, onFail, 'GET', true, "text/css"); 
                }
            }  
            
            return true; // async mode
            
        } else if (request.method == 'getProfile') {
            
            // method would be useful with eval onSuccess -> data, but its not safe so dont use it
            
            var	onFail = function(url, errorCode, errorText) {
            
                if (callback) {
                    
                    callback({
                        envText : false, 
                        profile : request.profile, 
                        error : 'load error',
                    });
                }
            }
            
            var onSuccess = function(data, url) {
                
                var environment = false;
                var error = '';
                
                if (callback) { 
                

                    callback({
                        env : K_DEFAULT_ENVIRONMENT, // initialized in eval data
                        profile : request.profile, 
                        error : error,
                    });
                }
            }
            
            var profile = KellyTools.getBrowser().runtime.getURL(KellyEDispetcher.envDir + 'profiles/' + request.profile + '.js');
            KellyTools.readUrl(profile, onSuccess, onFail); 
            
            return true; // async mode         
        } 
        
        if (callback) callback(response);        
    }