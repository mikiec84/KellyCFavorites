// part of KellyFavItems extension
// config saved onChangeState

// todo 

// - check dublicates during one task
// - ignore downloaded option
//   KellyTools.getBrowser().runtime.sendMessage({method: "isFilesDownloaded", filenames : [KellyTools.getUrlFileName(env.getImageDownloadLink(postMedia[0]))]}, onSearch);
// - revers numbers option
// for proper use need call - handler.getDownloadManager().onDownloadProcessChanged by chrome.api.downloads.onChanged

function KellyGrabber(cfg) {
    
    var handler = this;  
    
    // ids from chrome API that returned for each download process [only in progress items]
    
    var downloadingIds = []; 
  
    // array of current added throw method addDownloadItem download items
    // 
    // Download item object params :
    //     
    // .downloadId > 0     - accepted by API, downloading 
    // .downloadId = KellyGrabber.DOWNLOADID_GET_PROCESS    - request to API sended, waiting 
    // .downloadId = KellyGrabber.DOWNLOADID_INACTIVE - inactive 
    //
    // .workedout          - true if element already processed (check .error \ .downloadDelta for result)
    // 
    // .item               - reference to fav.item[n] object
    // .subItem            - index of fav.item.pImage if object has more then one image
    
    downloads = []; 
        
    // .downloadId values constants
  
    var downloadsOffset = 0; // start from element N
    var ids = 0; // counter for downloads
    
    var acceptItems = false;
    
    var events = { 
    
        /*
            onDownloadAllEnd(handler, result)
            
            calls when download process ended successfull or canceled by client (method handler.cancelDownloads)
            
            you can check list of all current downloads (see methods handler.getDownloads and handler.getDownloadItemState)            
            addition returned result data
            
            result = {
                total     - num af items in download process
                complete  - successfull downloaded
                failed    - fails num
                failItems - fail items as downloadItem ojects
                canceled  - is process was canceled by client
            }
        */
        
        onDownloadAllEnd : false, 
        
        /*
            onDownloadEnd(downloadItem) - download of downloadItem ended
            
            if setted downloadItem.error - last error message for item, empty if complete without errors 
            if setted downloadItem.downloadDelta and downloadItem.downloadDelta.state.current == "complete" - item sucessfull downloaded
            
        */
        
        onDownloadEnd : false,
        
        /*
            onDownloadStart(downloadItem) - download of downloadItem started (item successfull initialized and request according current requestMethod for file started)
        */
        
        onDownloadStart : false,
        
        /*
            onUpdateView - on redraw view, if return true, disable default redraw function
        */
        
        onUpdateView : false,
        
        onChangeState : false, // enter in new mode - cancel, download, wait
        
        onOptionsUpdate : false,
    };
    
    this.nameTemplate = false;
    
    var style = false;
    var className = 'kellyGrabber-';
    
    
    /*
        TRANSPORT_BLOBBASE64
    
        for bad designed browsers that cant catch blob url from front sended to background (currently 02.10.18 problem in firefox)
        so instead URL.createObjectURL(blob) string, full blob data encoded to base64 will be sended to background process for every file
        
        TRANSPORT_BLOB
        
        better performance
    */
    
    var transportMethod = KellyGrabber.TRANSPORT_BLOB; // TRANSPORT_BLOBBASE64;
    
    /*
        REQUEST_IFRAME 
        
        load url by iframe and get data from it throw postMessage, to avoid CORS
               
        REQUEST_XML 

        request url data by XML http request
    */
    
    var requestMethod = KellyGrabber.REQUEST_IFRAME;
    var requestIframeId = 0;

    
    var buttons = {};
    
    // configurable options. restored from kellyStorageManager (fav.coptions.grabber)
    
    var options = false;
    
    var mode = 'wait';
    var eventsEnabled = false;
    
    var extendedOptionsShown = false;
    
    // DOM elements
    
    // assigned
      
    this.container = false; // container for display controlls (method showGrabManager)
    
    // generated on showGrabManager
    
    this.btnsSection = false; // main buttons container
    var downloadProgress = false;
    var errorProgress = false;
        
    // last download process logged data
    var log = '';
    
    var failItems = [];
    
    var fav; // kellyFavItems obj
    var lng = KellyLoc;
    
    var availableItemsIndexes = [];
    var updateOptionsTimer = false;
    
    function constructor(cfg) {
		
        handler.resetOptions();
        handler.updateCfg(cfg);
		handler.initListeners();
    }
    
	this.initListeners = function() {
		
		KellyTools.getBrowser().runtime.onMessage.addListener(function(request, sender, callback) {

            var response = {
                method : request.method,
            }
            
            if (request.method == "onChanged") {       
                
                handler.onDownloadProcessChanged(request.downloadDelta); 

				if (callback) callback(response); 				
            }          
            
        });
		
	}
	
    this.getState = function() {    
        return mode;
    }
    
    this.getOptions = function() {
        return options;
    }
    
    this.getDriver = function() {
        
        return {
            requestMethod : requestMethod,
            transportMethod : transportMethod,
        }
    }
    
    // addDownloadItem - conflict action always - overwrite
    
    this.resetOptions = function() {
        options = {	
            nameTemplate : '#category_1#/#number#_#filename#', 
            baseFolder : 'grabber',
            maxDownloadsAtTime : 2,
            interval : 1,
            cancelTimer : 3 * 60, 
            quality : 'hd',
            itemsList : '',
            invertNumeration : true,
            skipDownloaded : false, 
        }        
    }
    
    this.updateCfg = function(cfg) {
    
        if (cfg) {
            if (cfg.container) handler.container = cfg.container;
        
            if (cfg.events) {
            
                for (var k in events){
                    if (typeof cfg.events[k] == 'function') {
                         events[k] = cfg.events[k];
                    }
                }
            }
            
            if (cfg.events === false) {
                for (var k in events){
                     events[k] = false;
                }               
            }
            
            if (cfg.options) {
                for (var k in options) {
                    if (typeof cfg.options[k] != 'undefined') {
                        
                        if (k == 'baseFolder') {
                            handler.setBaseFolder(cfg.options.baseFolder);
                        } else {
                            options[k] = cfg.options[k];
                        }
                    }
                }
            }
            
            if (cfg.className) {
                className = cfg.className;
            }
            
            
            if (cfg.fav) {
                fav = cfg.fav;
            }
            
            if (cfg.availableItemsIndexes) {
                availableItemsIndexes = cfg.availableItemsIndexes;
            }
            
            if (cfg.shownItems) {
                
                shownItems = cfg.shownItems;
            }
            
            if (cfg.imageClassName) {
                imageClassName = cfg.imageClassName;
            }
            
            if (cfg.driver) {
                cfg.driver = KellyGrabber.validateDriver(cfg.driver);
                
                requestMethod = cfg.driver.requestMethod;
                transportMethod = cfg.driver.transportMethod;
                
                KellyTools.log('init driver ' + requestMethod + ' | ' + transportMethod, 'KellyGrabber');
            }
        }
    }
    
    function delayUpdateOptionsEvent() {
        if (!events.onOptionsUpdate) return;

        if (updateOptionsTimer) {            
            clearTimeout(updateOptionsTimer); 
        }
    
        updateOptionsTimer = setTimeout(function() {
            updateOptionsTimer = false;
            events.onOptionsUpdate(handler);    
        }, 600);       
    }
        
    this.showGrabManager = function() {
    
        if (!handler.container) return false;
        
        var extendedClass = className + '-controll-extended ' + (extendedOptionsShown ? 'active' : 'hidden'); 
        var extendedShowTitle = {
            show : lng.s('Показать расширенные настройки', 'grabber_show_extended'),
            hide : lng.s('Скрыть расширенные настройки', 'grabber_hide_extended'),
        };
       
        if (!options.baseFolder) {
            handler.setBaseFolder(fav.getGlobal('env').profile + '/Downloads');
        }
       
        var html = '\
            <div class="' + className + '-controll">\
                <table>\
                    <tr><td>\
                        <label>' + lng.s('Основная директория', 'grabber_common_folder') + '</label>\
                    </td><td>\
                        <input type="text" placeholder="' + lng.s('Директория', 'folder') + '" class="' + className + '-controll-baseFolder" value="' + options.baseFolder + '">\
                    </td></tr>\
                    <tr><td>\
                        <label>' + lng.s('Элементы', 'grabber_selected_items') + '</label>\
                    </td><td>\
                        <input type="text" placeholder="1-2, 44-823, 1-999..." class="' + className + '-itemsList" value="' + options.itemsList + '">\
                    </td></tr>\
                    <!--tr class="' + className + '-range-tr"><td>\
                        <label>' + lng.s('Диапазон', 'grabber_range') + '</label>\
                    </td><td>\
                        <input type="text" placeholder="С" class="' + className + '-from" value="">\
                        <input type="text" placeholder="По" class="' + className + '-to" value="">\
                    </td></tr-->\
                    <tr class="' + className + '-quality-tr"><td colspan="2">\
                        <label><input type="radio" name="' + className + '_image_size[]" value="hd" class="' + className + '-quality" checked>' + lng.s('Оригинал', 'grabber_source') + '</label>\
                        <label><input type="radio" name="' + className + '_image_size[]" value="preview" class="' + className + '-quality">' + lng.s('Превью', 'grabber_preview') + '</label>\
                    </td></tr>\
                    <tr class="' + className + '-extended-show-row"><td colspan="2">\
                        <label><a href="#" class="' + className + '-extended-show">' + extendedShowTitle[extendedOptionsShown ? 'hide' : 'show'] + '</a></label>\
                    </td></tr>\
                    <tr class="' + extendedClass + '"><td>\
                        <label>' + lng.s('Шаблон названия', 'grabber_name_template') + ' (<a href="#" class="' + className + '-nameTemplate-help">' + lng.s('Подсказка', 'tip') + '</a>)</label>\
                    </td><td>\
                        <input type="text" placeholder="" class="' + className + '-nameTemplate" value="' + options.nameTemplate + '">\
                    </td></tr>\
                    <tr class="' + extendedClass + '"><td colspan="2">\
                        <label><input type="checkbox" class="' + className + '-invertNumeration" ' + (options.invertNumeration ? 'checked' : '') + '>\
                            ' + lng.s('Инвертировать нумерацию', 'grabber_flip_numbers') + '\
                        </label>\
                    </td></tr>\
                    <tr class="' + extendedClass + '"><td colspan="2">\
                        <label><input type="checkbox" class="' + className + '-skipDownloaded" ' + (options.skipDownloaded ? 'checked' : '') + '>\
                            ' + lng.s('Пропускать уже скачанные в директорию (по истории загрузок)', 'grabber_skip_downloaded') + '\
                        </label>\
                    </td></tr>\
                    <tr class="' + extendedClass + '"><td>\
                        <label>' + lng.s('Количество потоков', 'grabber_threads_num') + '</label>\
                    </td><td>\
                        <input type="text" placeholder="1" class="' + className + '-threads" value="' + options.maxDownloadsAtTime + '">\
                    </td></tr>\
                    <tr class="' + extendedClass + '"><td>\
                        <label>' + lng.s('Интервал загрузки (сек)', 'grabber_interval') + '</label>\
                    </td><td>\
                        <input type="text" placeholder="1" class="' + className + '-interval" value="' + options.interval + '">\
                    </td></tr>\
                    <tr class="' + extendedClass + '"><td>\
                        <label>' + lng.s('Таймаут при долгом выполнении запроса (сек)', 'grabber_timeout') + '</label>\
                    </td><td>\
                        <input type="text" placeholder="1" class="' + className + '-timeout" value="' + options.cancelTimer + '">\
                    </td></tr>\
                    <!--tr><td colspan="2">\
                        <label><input type="checkbox" class="' + className + '-exclude-low-res" value="1"></label>\
                        <label>' + lng.s('Исключать изображения с низким разрешением', 'grabber_exclude_lowres') + '</label>\
                    </td></tr-->\
                    <tr><td colspan="2"><div class="' + className + '-controll-buttons"></div></td></tr>\
                    <tr><td colspan="2">\
                        <div class="' + className + '-progressbar">\
                            <span class="' + className + '-progressbar-line ' + className + '-progressbar-line-ok"></span>\
                            <span class="' + className + '-progressbar-line ' + className + '-progressbar-line-err"></span>\
                            <span class="' + className + '-progressbar-state"></span>\
                        </div>\
                    </td></tr>\
                    <tr class="' + className + '-error-wrap hidden"><td colspan="2">\
                        <a class="' + className + '-error-counter" href="#"></a>\
                    </td></tr>\
                </table>\
            </div>\
        ';
        
        KellyTools.setHTMLData(handler.container, html);        
        
        errorProgress = {
            block : KellyTools.getElementByClass(handler.container, className + '-error-wrap'),
            counter : KellyTools.getElementByClass(handler.container, className + '-error-counter'),
            tooltip : false,
            rendered : false,
            updateTooltip : function() {
               
                if (!this.tooltip) {
                    return;
                }
                
                if (this.rendered !== false && this.rendered == failItems.length) {
                    return;
                }
                 
                 
                var failedList = '';
                 
                var html = '';
                for (var i=0; i < failItems.length; i++) {
                    
                    failedList += (failedList ? ',' : '') + failItems[i].num;
                    
                    html+= '<p><b>#' + failItems[i].num + '</b> - ' + failItems[i].reason + '</p>';
                }
                
                if (failedList) {
                    
                    html = '<p class="'  + className + '-error-list-itemsline">' + failedList + '</p>' + html;
                }

                var tcontainer = this.tooltip.getContent();
                KellyTools.setHTMLData(tcontainer, '<div class="'  + className + '-error-list">' + html + '</div>');            
                
                this.rendered = failItems.length;
            }
        };
         
        errorProgress.counter.onclick = function() {
            
            // todo move to public method
            
            var envVars = fav.getGlobal('env');
            
            if (!errorProgress.tooltip) {
                errorProgress.tooltip = new KellyTooltip({
                    target : 'screen', 
                    offset : {left : 20, top : -20}, 
                    positionY : 'bottom',
                    positionX : 'left',				
                    ptypeX : 'inside',
                    ptypeY : 'inside',
                    closeByBody : false,
                    closeButton : true,
                    removeOnClose : true,                    
                    selfClass : envVars.hostClass + ' ' + envVars.className + '-tooltipster-error',
                    classGroup : envVars.className + '-tooltipster',
                    events : {
                        onClose : function() {
                            errorProgress.tooltip = false;
                        }
                    }
                });
            }
            
            errorProgress.rendered = false;
            errorProgress.updateTooltip();
            
            setTimeout(function() {
                
                errorProgress.tooltip.show(true);                    
                errorProgress.tooltip.updatePosition();
                
            }, 100);
            
            return false;
        }        
            
        var baseFolderInput = KellyTools.getElementByClass(handler.container, className + '-controll-baseFolder');
            baseFolderInput.onchange = function() {
                
                handler.setBaseFolder(this.value);                
                this.value = options.baseFolder;
                delayUpdateOptionsEvent();
                return;
            }        
            
        var itemsList = KellyTools.getElementByClass(handler.container, className + '-itemsList');
            itemsList.onchange = function() {
                
                this.value = this.value.trim();
                
                if (this.value && !KellyTools.getPrintValues(this.value, false, 1, downloads.length).length) {                    
                    showNotice('grabber_selected_items_not_found', 1);    
                    this.value = '';
                }
                
                options.itemsList = this.value;                
                updateContinue(true);
                return;
            }  

        var invertNumeration = KellyTools.getElementByClass(handler.container, className + '-invertNumeration');
            invertNumeration.onchange = function() {
                
                options.invertNumeration = this.checked ? true : false;
                
                handler.clearStateForImageGrid();
                handler.updateStateForImageGrid();
                delayUpdateOptionsEvent();
                return;
            }  
            
        var skipDownloaded = KellyTools.getElementByClass(handler.container, className + '-skipDownloaded');
            skipDownloaded.onchange = function() {
                options.skipDownloaded = this.checked ? true : false;
                delayUpdateOptionsEvent();
                return;
            }              
            
        var nameTemplateHelp = KellyTools.getElementByClass(handler.container, className + '-nameTemplate-help');
            nameTemplateHelp.onclick = function() {
                
                showNotice('grabber_name_template_help', 5);
                return false;
            }
        
        var nameTemplate = KellyTools.getElementByClass(handler.container, className + '-nameTemplate');
            nameTemplate.onchange = function() {
                
                options.nameTemplate = KellyTools.validateFolderPath(this.value);                
                this.value = options.nameTemplate;
                
                handler.setDownloadTasks();
                delayUpdateOptionsEvent();
                return;
            }       
            
            
        var quality = handler.container.getElementsByClassName(className + '-quality');
        if (quality) {
            for (var i=0; i < quality.length; i++) {		
                quality[i].onclick = function() {
                    options.quality = this.value == 'hd' ? 'hd' : 'preview';
                    
                    handler.setDownloadTasks();
                    delayUpdateOptionsEvent();
                }
            }
        }
            
        var showExtend = KellyTools.getElementByClass(handler.container, className + '-extended-show');
            showExtend.onclick = function() {
                
                extendedOptionsShown = !extendedOptionsShown;
                
                var extOptions = handler.container.getElementsByClassName(className + '-controll-extended');
                if (extOptions) {
                    for (var i=0; i < extOptions.length; i++) {						
                        if (!extendedOptionsShown) {
                            extOptions[i].className = extOptions[i].className.replace('active', 'hidden');
                        } else {
                            extOptions[i].className = extOptions[i].className.replace('hidden', 'active');
                        }
                    }
                }
                
                this.innerText = extendedShowTitle[extendedOptionsShown ? 'hide' : 'show'];
                return false;
            }
        
        var threadsInput = KellyTools.getElementByClass(handler.container, className + '-threads');
            threadsInput.onchange = function() {
                                
                options.maxDownloadsAtTime = parseInt(this.value);
                if (!options.maxDownloadsAtTime || options.maxDownloadsAtTime < 0) options.maxDownloadsAtTime = 1;
                
                this.value = options.maxDownloadsAtTime;
                delayUpdateOptionsEvent();
            }
   
        var intervalInput = KellyTools.getElementByClass(handler.container, className + '-interval');
            intervalInput.onchange = function() {
                                
                options.interval = KellyTools.val(this.value, 'float');               
                if (!options.interval || options.interval < 0.1) options.interval = 0.1;
               
                this.value = options.interval;
                delayUpdateOptionsEvent();
            }
            
        var cancelInput = KellyTools.getElementByClass(handler.container, className + '-timeout');
            cancelInput.onchange = function() {
                                
                options.cancelTimer = KellyTools.val(this.value, 'float');                
                if (!options.cancelTimer || options.cancelTimer < 2) options.cancelTimer = 5 * 60;                
                
                this.value = options.cancelTimer;
                delayUpdateOptionsEvent();
            } 
            
        downloadProgress = {
            line : KellyTools.getElementByClass(handler.container, className + '-progressbar-line-ok'),
            lineErr : KellyTools.getElementByClass(handler.container, className + '-progressbar-line-err'),
            state : KellyTools.getElementByClass(handler.container, className + '-progressbar-state'),
        }
    
        handler.btnsSection = KellyTools.getElementByClass(handler.container, className + '-controll-buttons');
        
        // add controll buttons
        
        buttons = {};
        handler.addControllEl('init', ''); 
        
        var continueBtn = handler.addControllEl('continue', lng.s('Продолжить', 'grabber_continue'), function() {
            
            if (mode != 'wait') return false;
            
            downloadsOffset = parseInt(this.getAttribute('data-start-from'));
            
            handler.download();  
            
            updateContinue(true); 
            return false;
        });  
        
        continueBtn.style.display = 'none';        
        
        handler.addControllEl('save_as_json', lng.s('Скачать файл данных', 'grabber_save_as_json'), function() {
        
            fav.downloadFilteredData();            
            return false;
        }); 

        var logBtn = handler.addControllEl('save_log', lng.s('Скачать лог', 'grabber_save_log'), function() {
        
            downloadLog();            
            return false;
        });   

        logBtn.style.display = 'none';
        
        handler.updateStartButtonState('start');
        updateProgressBar();        
    }
    
    function updateProgressBar() {
        
        if (downloadProgress && downloadProgress.line) { 
        
            var total = downloads.length;
            if (acceptItems) {
                total = acceptItems.length;
            }
            
            var current = handler.countCurrent('complete');
            if (current > total) {
                toTxtLog('COUNTER more that total items. CHECK COUNTER ' + current + ' / ' + total);
                current = total;
            }
            
            var complete = Math.round(current / (total / 100));
            var bad = failItems.length ? Math.round(failItems.length / (total / 100)) : 0;
                        
            downloadProgress.state.innerText = current + ' / ' + total;        
            downloadProgress.line.style.width = complete + '%';
            
            if (bad > 0) {
                downloadProgress.lineErr.style.width = bad + '%';
            } else {
                downloadProgress.lineErr.style.width = '0px';
            }
        }
        
        if (errorProgress && errorProgress.block) {
            if (failItems.length) {
                
                if (errorProgress.block.className.indexOf('active') == -1) {
                    errorProgress.block.className = errorProgress.block.className.replace('hidden', 'active');
                }
                
                errorProgress.counter.innerText = lng.s('Ошибки загрузки : __ERRORSNUM__', 'grabber_errors_counter', {ERRORSNUM : failItems.length});                
                errorProgress.updateTooltip();
                
            } else {
                
                if (errorProgress.block.className.indexOf('hidden') == -1) {
                    errorProgress.block.className = errorProgress.block.className.replace('active', 'hidden');
                }
            }
        }
    }
    
    function downloadLog() {
    
        var fname = fav.getGlobal('options').baseFolder + '/' + fav.getStorageManager().dir.logs;
            fname += 'download_log_' + KellyTools.getTimeStamp() + '.log';
            fname = KellyTools.validateFolderPath(fname);
            
        fav.getDownloadManager().createAndDownloadFile(log, fname);
        
    }
    
    function optionsFormDisable(disable) {
        
        if (!handler.container) return;
        
        var inputs = handler.container.getElementsByTagName('input');
        
        if (!inputs || !inputs.length) return;
        
        for (var i = 0; i < inputs.length; i++) {
            
            inputs[i].disabled = disable;
        }
    }
    
    function showState(state) {
        
        if (!state) state = 'undefined';
        
        var html = '';
        
        if (state == "complete") {
            html += '<div class="' + className + '-item-state ' + className + '-item-state-ok" data-notice="' + lng.s('Загрузка завершена', 'grabber_state_ready') + '"></div>';
        } else if (state == "in_progress") {
            html += '<div class="' + className + '-item-state ' + className + '-item-state-loading" data-notice="' + lng.s('Загрузка...', 'grabber_state_loading') + '" ></div>';
        } else if (state == 'wait') {
            html += '<div class="' + className + '-item-state ' + className + '-item-state-wait" data-notice="' + lng.s('Ожидает в очереди', 'grabber_state_wait') + '"></div>';
        } else if (state == 'error') {
            html += '<div class="' + className + '-item-state ' + className + '-item-state-err" data-notice="' + lng.s('Ошибка загрузки', 'grabber_state_error') + '"></div>'; // todo вывод деталей ошибки, сохраняется в lastError?
        } else if (state == 'skip') {
            html += '<div class="' + className + '-item-state ' + className + '-item-state-skip" data-notice=""></div>'; 
        }  else {
            html += '<div class="' + className + '-item-state ' + className + '-item-state-undefined" data-notice=""></div>';
        }
         
        return html;
    }
    
    function showNotice(localizationKey, num) {
        
        if (!num) num = 1;
                                       
        var envVars = fav.getGlobal('env');
        var tooltip = new KellyTooltip({
            target : 'screen', 
            offset : {left : 20, top : -20}, 
            positionY : 'bottom',
            positionX : 'left',				
            ptypeX : 'inside',
            ptypeY : 'inside',
           // closeByBody : true,
            closeButton : true,
            removeOnClose : true,                    
            selfClass : envVars.hostClass + ' ' + envVars.className + '-tooltipster-help',
            classGroup : envVars.className + '-tooltipster',
        });
           
        var html = lng.s('', localizationKey);
        
        if (num > 1) {
            for (var i = 1; i <= num; i++) {
                html += lng.s('', localizationKey + '_' + i);
            }
        }
           
        var tcontainer = tooltip.getContent();
        KellyTools.setHTMLData(tcontainer, '<div>' + html + '</div>');
        
        tooltip.show(true);   
        tooltip.updatePosition();
        
        setTimeout(function() {
            tooltip.updateCfg({closeByBody : true});            
        }, 400);     
                    
        return true;
    }
    
    function showDownloadItemInfoTooltip(downloadIndex, target) {
    
        if (KellyTools.getElementByClass(document, fav.getGlobal('env').className + '-tooltipster-help')) {
            return;
        }
        
        if (!downloads[downloadIndex]) return;
        
        if (!handler.initDownloadItemFile(downloads[downloadIndex])) return;
        
        var item = downloads[downloadIndex].item;
        var tooltipEl = fav.getTooltip();
            tooltipEl.updateCfg({
                target : target, 
                offset : {left : 0, top : 0}, 
                positionY : 'bottom',
                positionX : 'left',				
                ptypeX : 'inside',
                ptypeY : 'outside',
                avoidOutOfBounds : false,
                closeButton : true,
            });
            
        var baseClass = fav.getGlobal('env').className + '-tooltipster-ItemInfo ' + fav.getGlobal('env').className + '-tooltipster-DownloaderItemInfo';
        
        var itemInfo = document.createElement('div');
            itemInfo.className = baseClass;
            itemInfo.id = baseClass + '-' + downloadIndex;
            
        var html = lng.s('Сохранить как', 'grabber_save_as') + ' : <br>' + downloads[downloadIndex].filename + '.' + downloads[downloadIndex].ext + '<br><br>';
            html += fav.showItemInfo(item);
            
            if (downloads[downloadIndex].error) {
                html += 'error : ' + downloads[downloadIndex].error + '<br><br>';
                console.log(downloads[downloadIndex]);
            }
            
            KellyTools.setHTMLData(itemInfo, html);
    
        var tcontainer = tooltipEl.getContent();
            tcontainer.innerHTML = '';
            tcontainer.appendChild(itemInfo);
            
        tooltipEl.show(true);
        fav.tooltipBeasy = true;
    }
    
    this.clearStateForImageGrid = function() {
            
        for (var i = 0; i <= downloads.length-1; i++) {
                
            if (!downloads[i].item) continue;
            
            var downloadItemId = imageClassName + '-' + downloads[i].item.id;
           
            var itemContainer = document.getElementById(downloadItemId);
            if (!itemContainer) {
                continue;
            }       
            
            var holder = KellyTools.getElementByClass(itemContainer, imageClassName + '-download-state-holder');
            
            if (holder) {
                holder.parentElement.removeChild(holder);
            }
        }            
    }
    
    this.updateStateForImageGrid = function() {
        
        if (events.onUpdateView && events.onUpdateView(handler)) return;
        
        var subItems = {};
        // var gridItems = this.imageGrid.getTiles();
        
        for (var i = 0; i <= downloads.length-1; i++) {
                
            //    KellyTools.log(handler.isItemShown(downloads[i].item));
            if (!downloads[i].item) continue;
            
            var downloadItemId = imageClassName + '-' + downloads[i].item.id;
            var itemN = options.invertNumeration ? downloads.length - i : i + 1;
         
            if (downloads[i].subItem !== false) {                
                if (!subItems[downloads[i].item.id]) subItems[downloads[i].item.id] = [];
                subItems[downloads[i].item.id].push(i);                
            }
            
            var itemContainer = document.getElementById(downloadItemId);
            if (!itemContainer) {
                continue;
            }       
            
            // KellyTools.log(imageClassName + '-' + downloads[i].item.id);
        
            var holder = KellyTools.getElementByClass(itemContainer, imageClassName + '-download-state-holder');
                        
            if (!holder) {
                
                holder = document.createElement('DIV');
                holder.className = imageClassName + '-download-state-holder';
                holder.setAttribute('downloadIndex', i);
                
                var title = '#' + itemN;
                if (downloads[i].subItem !== false) {
                    
                    var itemNto = options.invertNumeration ? itemN - downloads[i].item.pImage.length+1 : itemN + downloads[i].item.pImage.length-1;
                    title += '-#' + itemNto;
                }
              
                var html = '\
                    <div class="' + imageClassName + '-download-number" data-start="' + itemN + '"><span>' + title + '</span></div>\
                    <div class="' + imageClassName + '-download-status"></div>\
               ';
               
                KellyTools.setHTMLData(holder, html);
                itemContainer.appendChild(holder);
                                
                /* не проработаны исключения
                var envVars = fav.getGlobal('env');
                
                var tooltipOptions = {
                    offset : {left : 0, top : 0}, 
                    positionY : 'top',
                    positionX : 'right',				
                    ptypeX : 'outside',
                    ptypeY : 'inside',
                    closeButton : false,

                    selfClass : envVars.hostClass + ' ' + envVars.className + '-ItemTip-tooltipster',
                    classGroup : envVars.className + '-tooltipster',
                    removeOnClose : true,
                };
                
                KellyTooltip.addTipToEl(holder, function(el, e){
                
                    return showDownloadItemInfoTooltip(el.getAttribute('downloadIndex'));
                
                }, tooltipOptions, 100);       
                */
                
                holder.onclick = function(e) {                
                    
                    // if (fav.getTooltip().isShown()) return false;
                    
                    var itemIndex = this.getAttribute('downloadIndex');
                    showDownloadItemInfoTooltip(this.getAttribute('downloadIndex'), this);
                    
                    return false;
                }  
                
                /*
                holder.onmouseover = function(e) {                
                    
                    var itemIndex = this.getAttribute('downloadIndex');
                    showDownloadItemInfoTooltip(this.getAttribute('downloadIndex'), this);
                }  
                    
                holder.onmouseout = function(e) {    
                    
                    var related = e.toElement || e.relatedTarget;
                    if (fav.getTooltip().isChild(related)) return;
                        
                    fav.getTooltip().show(false);
                }  
                */              
            } 
            
            var statusPlaceholder = KellyTools.getElementByClass(holder, imageClassName + '-download-status');
            
            // update state by last item in collection

            if (downloads[i].subItem === false || downloads[i].subItem == downloads[i].item.pImage.length-1) {
                
                var html = '';
                
                if (downloads[i].subItem === false) {
                    
                    html = showState(handler.getDownloadItemState(downloads[i]));
                } else {
                    
                    // KellyTools.log(subItems[downloads[i].item.id]);
                    var subItemsStat = {
                        wait : 0,
                        complete : 0,
                        in_progress : 0,
                        error : 0,
                        skip : 0,
                    }
                    
                    for (var b = 0; b < subItems[downloads[i].item.id].length; b++) {    
                        var subItemState = handler.getDownloadItemState(downloads[subItems[downloads[i].item.id][b]]);
                        subItemsStat[subItemState]++;                        
                        
                        if ( subItemsStat[subItemState] == subItems[downloads[i].item.id].length ) {
                             html = showState(subItemState);
                        }
                    }
                    
                    if (!html) html = showState('in_progress');
                }
            
                KellyTools.setHTMLData(statusPlaceholder, html);
            }
        }
        
        setTimeout(function() {
            
            var textNodes = document.getElementsByClassName(imageClassName + '-download-number');
            for (var i = 0; i < textNodes.length; i++) {
                var textNode = KellyTools.getElementByTag(textNodes[i], 'span');                
                KellyTools.fitText(textNodes[i], textNode);
            }
            
        }, 100);
    }  
    
    this.getDownloadItemState = function(ditem) {
        
        if (!ditem.item) return 'skip';
        
        var itemIndex = downloads.indexOf(ditem);        
        if (itemIndex == -1) return 'skip';
        
        var acceptIndex = options.invertNumeration ? downloads.length - itemIndex : itemIndex+1;        
        if (acceptItems && acceptItems.indexOf(acceptIndex) == -1) return 'skip';
        
        // currently count any. Possible states - downloadDelta.state.current == "interrupted" / "complete"
        
        if (ditem.downloadDelta) { 
            
            return 'complete';
            
        } else if (ditem.error) {
                             
            return 'error';
            
        } else if (ditem.canceling) {
            
            return 'canceling';
            
        } else if ((ditem.dataRequest) || (ditem.downloadId && ditem.downloadId > 0) || (ditem.downloadId && ditem.downloadId === KellyGrabber.DOWNLOADID_GET_PROCESS)) {
            
           return 'in_progress';
            
        } else {
            
           return 'wait'; // inlist \ wait 
        }
    }
    
    this.onDownloadProcessChanged = function(downloadDelta) {
        
        if (mode != 'download') return;
        
        // KellyTools.log('incoming ' + downloadDelta.id);
        
        // if its not our item then exit
        
        if (downloadingIds.indexOf(downloadDelta.id) === -1) {
            KellyTools.log('download id not found, skip ' + downloadDelta.id, 'KellyGrabber');
            return false;
        }
        
        if (downloadDelta.state) {
            
            if (downloadDelta.state.current != "in_progress") {
                
                // KellyTools.log(downloadDelta);
                downloadingIds.splice(downloadingIds.indexOf(downloadDelta.id), 1);
            
                var downloadIndex = handler.getDownloadById(downloadDelta.id);
                if (downloadIndex === false) {
                
                    KellyTools.log('item by download id not found in common stack', 'KellyGrabber');
                    KellyTools.log(downloadDelta, 'KellyGrabber');
                    
                    return false;
                }
                
                var downloadItem = downloads[downloadIndex];
                   
                if (downloadItem.cancelTimer) {
                    clearTimeout(downloadItem.cancelTimer);
                    downloadItem.cancelTimer = false;
                }
                 
                downloadItem.downloadDelta = downloadDelta;
                downloadItem.workedout = true;
                
                updateProgressBar();
                
                handler.onDownloadEnd(downloadItem);
               
            } else {
                
                // KellyTools.log(downloadDelta);
                // KellyTools.log(downloadDelta.url + 'download process ' + downloadDelta.fileSize);
            } 
            
            
        }
        
        handler.updateStateForImageGrid();
    }
    
    function updateProcessState(canceled) {
            
        var inProgress = handler.countCurrent('in_progress');
        var waitingNum = handler.countCurrent('wait');
        
        if ((!waitingNum && !inProgress) || canceled) {
            
            if (events.onDownloadAllEnd) {
                
                var response = {
                    
                    total : acceptItems ? acceptItems.length : downloads.length,
                    complete : handler.countCurrent('complete'),
                    failed : failItems.length,
                    failItems : failItems,
                    canceled : canceled ? true : false,
                }
                
                events.onDownloadAllEnd(handler, response);
            }
                                
            handler.updateStartButtonState('start');
            
            var hideContinue = canceled ? false : true;
            
            updateContinue(hideContinue);
            updateProgressBar(); 
        } 
        
        return {inProgress : inProgress, waitingNum : waitingNum};
    }
    
    this.onDownloadEnd = function(ditem) {
        
        var curState = updateProcessState();                
        if (curState.waitingNum) {
        
            setTimeout(function() {                        
                handler.addDownloadWork();
            }, options.interval * 1000);
        }
               
        if (events.onDownloadEnd) {
            // downloadDelta.id, filename, totalBytes
            events.onDownloadEnd(handler, ditem, handler.getDownloadItemState(ditem));                    
        }

        KellyTools.log('current in progress ' + curState.inProgress + ' | wait ' + curState.waitingNum, 'KellyGrabber');                
    }
    
    this.getControllEl = function(key) {
        return buttons[key] ? buttons[key] : false;
    }
    
    this.addControllEl = function(key, name, onClick, type) {
        
        if (buttons[key]) return false;
        
        if (!handler.btnsSection) return false;
        
        var btn =  document.createElement(type ? type : 'A');        
            btn.className = className + '-button ' + className + '-button-' + key;
            btn.href = "#";
            btn.innerText = name;
            
        if (onClick) btn.onclick = onClick;
            
        handler.btnsSection.appendChild(btn);
        
        buttons[key] = btn;
        return btn;
    }
    
    this.closeGrabManager = function() {
 
        if (!handler.container) return false;
        
        handler.cancelDownloads(function() {               
            buttons = {};
            handler.container.innerHTML = ''; 
            downloads = [];
        });
                 
    }
    
    function getNameTemplate() {
        
        if (!options.nameTemplate) {
            options.nameTemplate = '#category_1#/#id#_#category_1#_#category_2#_#category_3#';
        }
        
        return options.nameTemplate;
    }
    
    this.initDownloadItemFile = function(ditem) {
        
        if (ditem.filename !== false) {
            return ditem;
        }
        
        var item = ditem.item;
        
        if (typeof item.pImage !== 'string') {                           
            ditem.url = fav.getGlobal('env').getImageDownloadLink(item.pImage[ditem.subItem], options.quality == 'hd');            
        } else {        
            ditem.url = fav.getGlobal('env').getImageDownloadLink(item.pImage, options.quality == 'hd');
        }        
               
        if (!ditem.url || ditem.url.length < 6) {
                        
            addFailItem(ditem, 'Некорректный Url скачиваемого файла ' + ditem.url);
            return false;
            
        } else {
            
            ditem.ext = KellyTools.getExt(ditem.url);
            
            if (!ditem.ext) {  
                
                addFailItem(ditem, 'Неопределено расширение для загружаемого файла ' + ditem.url);
                return false;
            }
        }
                
        var fileName = getNameTemplate();       
        if (item.categoryId) {            
        
            var categories = fav.getGlobal('fav').categories;
            var sm = fav.getStorageManager();
                sm.sortCategories(categories);
               
            var itemCatN = 0;
              
            for (var i = 0; i < categories.length; i++) {            
                if (item.categoryId.indexOf(categories[i].id) != -1) {
                    itemCatN++;
                    // KellyTools.log('#category_' + itemCatN + '#' + ' - replace - ' + favItems.categories[i].name);
                    fileName = KellyTools.replaceAll(fileName, '#category_' + itemCatN + '#', categories[i].name);
                }                
            }            
        }        
        
        if (item.name) {
            fileName = KellyTools.replaceAll(fileName, '#name#', item.name);
        } else {
            fileName = KellyTools.replaceAll(fileName, '#name#', '');
        }
        
        if (item.id) {
            fileName = KellyTools.replaceAll(fileName, '#id#', item.id);
        } else {
            fileName = KellyTools.replaceAll(fileName, '#id#', '');
        }    
        
        var originalName = false;
        
        if (fileName.indexOf('#filename#') != -1) {
            
            var fullSize = options.quality == 'hd';     
            originalName = true;
            
            var fileUrlName = KellyTools.getUrlFileName(ditem.url, true);
            
            if (!fileUrlName) {
                
                KellyTools.log('cant find filename for ' + item.id);
                KellyTools.log(item);
                KellyTools.log(getNameTemplate());
                
                addFailItem(ditem, 'Ошибка получения имени файла (#filename#) для Url ' + ditem.url);                
                return false;
            }
            
            fileName = KellyTools.replaceAll(fileName, '#filename#', fileUrlName);
        }
        
        if (fileName.indexOf('#number#') != -1) {
                        
            fileName = KellyTools.replaceAll(fileName, '#number#', handler.getDownloadItemN(ditem)); 
        }
        
        fileName = KellyTools.replaceAll(fileName, /#category_[1-9]+#/, '');        
        fileName = KellyTools.validateFolderPath(fileName);
        
        if (!fileName){
            addFailItem(ditem, 'Ошибка валидации шаблона пути для загружаемого файла ' + ditem.url);
            return false;
        }    
        
        if (!originalName && ditem.subItem > 0) {
            fileName += '_' + ditem.subItem;
        }
        
        ditem.filename = fileName;
        
        return ditem;
    }
        
    // переинициализировать список задач, при изменении конфигурации \ обновлении фильтров в основном расширении    
    
    this.setDownloadTasks = function(indexes) {
        
        if (handler.getState() == 'download') {
            return;            
        }
        
        handler.clearDownloads();
        
        if (indexes) {
            availableItemsIndexes = indexes;
        }
        
        var items = fav.getGlobal('fav').items;
            
        for (var i = 0; i < availableItemsIndexes.length; i++) {
        
            var item = items[availableItemsIndexes[i]]
            if (!item.pImage) continue; 
            
            if (typeof item.pImage !== 'string') {
            
                for (var b = 0; b <= item.pImage.length-1; b++) {
                    handler.addDownloadItem(item, b);
                }
                
            } else {
            
                handler.addDownloadItem(item);
            }
        }  
        
        updateContinue(true);                
        updateProgressBar(); 
        //KellyTools.createAndDownloadFile('test', 'test.txt');
    }
    
    this.setBaseFolder = function(folder) {
    
        var tmpFolder = KellyTools.validateFolderPath(folder);
        if (tmpFolder) {
            options.baseFolder = tmpFolder;
        }
        
        return options.baseFolder;
    }
    
   
    this.getDownloads = function() {
        // todo deselect inaccepted 
        return downloads;
    }
    
    // full reset
    
    this.clearDownloads = function() {
        downloads = [];
        downloadingIds = [];
        acceptItems = false;
        failItems = [];
        log = '';
    }
    
    function changeState(state) {
        
        if (state == mode) return;
        
        mode = state;
        
        if (events.onChangeState) {
            events.onChangeState(handler, state);
        }        
    }
    
    this.updateStartButtonState = function(state) {
                
        if (state == 'start') {
            
            optionsFormDisable(false);
            changeState('wait');
            
            if (buttons['init']) {
                buttons['init'].innerText = lng.s('Начать выгрузку', 'grabber_start');
                buttons['init'].onclick = function() { 
                    downloadsOffset = 0;
                    handler.resetDownloadItems(false);
                     
                    KellyTools.getBrowser().runtime.sendMessage({method: "onChanged.keepAliveListener"}, function(response) {
                        handler.download();
                    }); 
                    
                    return false;
                }
            }
            
        } else {            
            
            optionsFormDisable(true);
            changeState('download');
            
            if (buttons['init']) {
                buttons['init'].innerText = lng.s('Остановить загрузку', 'grabber_stop');
                buttons['init'].onclick = function() {
                    handler.cancelDownloads();
                    return false;
                }       
            }
        }
      
        if (log && buttons['save_log']) {
             buttons['save_log'].style.display = 'block';
        }       
    }
    
    // show \ hide continue button, update continue button cursor if current process wasnt fully finished
    
    function updateContinue(hide) {
        
        if (!buttons['continue']) return;
        
        if (hide) {
            buttons['continue'].style.display = 'none';
            return;
        }
        
        var lastReadyIndex = 0;
        for (var i = downloadsOffset; i <= downloads.length-1; i++) {
            var state = handler.getDownloadItemState(downloads[i]);            
            if (state != 'complete' && state != 'skip') {
                break;
            } else {               
               lastReadyIndex = i;
            }
        }
        
        if (lastReadyIndex) {
            buttons['continue'].setAttribute('data-start-from', lastReadyIndex);            
            buttons['continue'].style.display = 'block';
        } else {
            buttons['continue'].style.display = 'none';
        }
    }
    
    this.cancelDownloads = function(onCancel) {    
        
        if (!downloads.length) return;
        
        if ( buttons['init'] ) {
             buttons['init'].innerText = lng.s('Остановка...', 'grabber_canceling');        
        }
        
        changeState('cancel');
             
        var untilStop = 0;      
 
        var checkAllCanceled = function() {            
            
            if (untilStop <= 0) {
                
                updateProcessState(true); 
                handler.resetDownloadItems(true);
                
                if (onCancel) onCancel();
            }
        }
        
        var cancelDownloadItem = function(downloadItem) {
            
            downloadItem.canceling = true;
            
            KellyTools.getBrowser().runtime.sendMessage({method: "downloads.cancel", downloadId : downloadItem.downloadId}, function(response) {
                
                untilStop--;
                
                resetItem(downloadItem);                
                checkAllCanceled();
            });    
        }
        
        for (var i=0; i < downloads.length; i++) {
            
            if (handler.getDownloadItemState(downloads[i]) == 'in_progress') {
                                
                if (downloads[i].dataRequest) {                
                    downloads[i].dataRequest.abort();  
                    downloads[i].dataRequest = false;
                }
            
                if (downloads[i].cancelTimer) {
                    clearTimeout(downloads[i].cancelTimer);
                    downloads[i].cancelTimer = false;
                }
                
                if (downloads[i].downloadId && downloads[i].downloadId > 0) {
                    untilStop++;
                    cancelDownloadItem(downloads[i]);         
                }
            } 
        }
                      
        checkAllCanceled();    
    }
    
    this.addDownloadItem = function(item, subItem, conflictAction) {
        
        if (!item) return false;
        
        ids++;

        if (item && typeof item.pImage !== 'string') {
            subItem = subItem <= item.pImage.length-1 ? subItem : 0;
        } else subItem = false;
            
        var dIndex = downloads.push({
            
            id : ids, 
            filename : false, 
            url : false, 
            conflictAction : !conflictAction ? 'overwrite' : conflictAction, 
            ext : false,
            
            downloadId : false,
            
            item : item,
            subItem : subItem, 
        }) - 1;

        return downloads[dIndex];
    }
    
    this.getDownloadById = function(id) {
                
        for (var i=0; i <= downloads.length-1; ++i) {
            if (downloads[i].downloadId === id) {
                return i;
            }
        }
        
        return false;
    }
        
    this.downloadUrl = function(downloadOptions, onDownload) {
        
        if (!downloadOptions) return false;
        if (!downloadOptions.url) return false;
        if (!downloadOptions.filename) return false;
        
        if (!onDownload) {
            // some browser require default response function for API
            onDownload = function(response) {};
        }
        
        var isBlob = false;
        if (downloadOptions.url instanceof Blob) {
            downloadOptions.url = URL.createObjectURL(downloadOptions.url);
            isBlob = true;
        }
        
        KellyTools.getBrowser().runtime.sendMessage({method: "downloads.download", blob : isBlob, download : downloadOptions}, onDownload);             
        
        return true;
    }
    
    
    function toTxtLog(str) {
    
        log += '[' + KellyTools.getTime() + '] ' + str + "\r\n";
    }
    
    // download file by request as blob data. GET | ASYNC
    // callback(url, data (false on fail), errorCode, errorNotice);
    
    this.getDataFromUrl = function(urlOrig, callback) {
        
        if (requestMethod == KellyGrabber.REQUEST_XML) {
        
            var xhr = new XMLHttpRequest();
                xhr.responseType = 'blob';

                xhr.onload = function(e) {
                    if (this.status == 200) {
                        
                        if (transportMethod == KellyGrabber.TRANSPORT_BLOBBASE64) {
                            
                            KellyTools.blobToBase64(this.response, function(base64) {
                                
                                callback(urlOrig, {base64 : base64, type : xhr.getResponseHeader('content-type')});
                              
                            });
                            
                        } else {
                        
                            callback(urlOrig, this.response);
                        }
                        
                    } else {
                        callback(urlOrig, false, this.status, this.statusText);
                    }
                };

                xhr.onerror = function(e) {
                    
                    callback(urlOrig, false, -1, 'check connection or domain mismatch (Access-Control-Allow-Origin header) | input url ' + urlOrig);
                };

                xhr.open('get', urlOrig, true);
                xhr.send();  
            
            return xhr;
            
        } else {
            
            var getIframe = function() {
            
                requestIframeId++;
                
                var iframe = document.createElement('iframe');
                    iframe.name = className + '-iframe-' + requestIframeId;
                    iframe.style.display = 'none';
                    iframe.style.width   = '1px';
                    iframe.style.height  = '1px';
                    
                document.getElementsByTagName('body')[0].appendChild(iframe);  
                return iframe;    
            }            
            
            var iframe = getIframe();
            
            var eventPrefix = 'input_message_' + iframe.name;
            var closeConnection = false;
            var onLoadIframe = false;                        
            
            onLoadIframe = function(e) {
                     
                if (!e.data || !e.data.method || closeConnection) return false;
                
                if (iframe && iframe.contentWindow === e.source) {        
                    
                    if (e.data.method.indexOf('mediaReady') != -1) {
                        
                        e.source.postMessage({method : 'getMedia'}, "*");
                        
                    } else if (e.data.method.indexOf('sendResourceMedia') != -1) {
                        
                        closeConnection = true;
                        
                        if (e.data.base64) {
                            
                            var ext = KellyTools.getUrlExt(urlOrig);
                            var mimetype = getMimeType(ext);
                            
                            callback(urlOrig, {base64 : e.data.base64, type : mimetype});  
                            
                        } else {
                            
                            // если разорвано подключение \ картинка недоступна - e.data.error = url load fail
                            // в случае если подключение блокирует adblock или еще какой-либо внешний процесс, то обратная связь пропадает (остается только таймаут)
                            
                            callback(urlOrig, false, -1, 'iframe load fail - ' + e.data.error);
                        }
                        
                        abortIframe();                       
                    }                    
                }
            }
                        
            var abortIframe = function() {
                fav.removeEventPListener(window, "message", onLoadIframe, eventPrefix);
            
                iframe.src = '';
                iframe.onload = function() {}
                iframe.onerror = function() {}
                
                if (iframe.parentElement) {
                    iframe.parentElement.removeChild(iframe);
                }
            }
            
            iframe.onerror = function() {      
            
                callback(urlOrig, false, -1, 'iframe load fail - connection error');                
                abortIframe();
            }

            fav.removeEventPListener(window, "message", onLoadIframe, eventPrefix);	
            fav.addEventPListener(window, "message", onLoadIframe, eventPrefix);
            
            iframe.src = urlOrig;
            
            return {type : 'iframe', self : iframe, abort : abortIframe};
        }
    }
    
    function getMimeType(ext) {
        
        var mimetype = 'application/x-' + ext;
        
        // MIME type list http://webdesign.about.com/od/multimedia/a/mime-types-by-content-type.htm
        
             if (ext == 'jpg' || ext == 'jpeg') mimetype = 'image/jpeg';
        else if (ext == 'png' ) mimetype = 'image/png';
        else if (ext == 'gif' ) mimetype = 'image/gif';
        else if (ext == 'zip' ) mimetype = 'application/zip';
        else if (ext == 'txt' ) mimetype = 'text/plain';
        else if (ext == 'json' ) mimetype = 'application/json';
        
        return mimetype;
    }
    
    // fileData - arrayBuffer or plain text
    
    this.createAndDownloadFile = function(fileData, filename, mimetype) {

        if (!fileData) return false;
        if (!KellyTools.getBrowser()) return false;
        
        var ext = KellyTools.getExt(filename);
        if (!ext) ext = 'txt';
        
        if (!mimetype) {
             mimetype = getMimeType(ext);
        }
        
        if (filename.indexOf('.') == -1) filename += '.' + ext;
        
        var downloadOptions = {
            filename : filename, 
            conflictAction : 'uniquify',
            method : 'GET',
        }
        
            downloadOptions.url = new Blob([fileData], {type : mimetype});
        
        if (fav.isDownloadSupported) {
            
            var startDownload = function() {
                
                handler.downloadUrl(downloadOptions, function(response) {
                    if (!response) {
                        
                        KellyTools.log('download fail : empty response. Check background process log for more details', 'KellyGrabber', KellyTools.E_ERROR);
                        return;
                    }
                    if (response.error) {
                        
                        KellyTools.log('download fail ' + response.error, 'KellyGrabber', KellyTools.E_ERROR);
                    }
                    
                });
                
            }
            
        } else {
            
            var startDownload = function() {
                
                var link = document.createElement("A");                
                    link.style.display = 'none';
                    link.onclick = function() {
                        
                        var url = window.URL.createObjectURL(downloadOptions.url);
                        
                        this.href = url;
                        this.download = KellyTools.getUrlFileName(filename);
                        
                        setTimeout(function() {
                           window.URL.revokeObjectURL(url);
                           link.parentElement.removeChild(link);
                        }, 4000);
                    }
                    
                document.body.appendChild(link);    
                link.click();
            }
        }
        
        if (fav.isDownloadSupported && transportMethod == KellyGrabber.TRANSPORT_BLOBBASE64) {
                
            KellyTools.blobToBase64(downloadOptions.url, function(base64) {              
                downloadOptions.url = {base64 : base64, type : mimetype};
                startDownload();
            });
            
        } else {
            
            startDownload();
        }     
        
        return true;
    }
    
    function addFailItem(item, reason) {
        
        failItems[failItems.length] = {
            num : handler.getDownloadItemN(item),
            reason : reason,
        }
    }
    
    this.getDownloadItemN = function(ditem) {        
    
        var itemIndex = downloads.indexOf(ditem);        
        var N = options.invertNumeration ? downloads.length - itemIndex : itemIndex+1;
        
        // save right order inside collections
        
        if (options.invertNumeration && typeof ditem.item.pImage !== 'string') {
            
            N -= (ditem.item.pImage.length - ditem.subItem - 1) - ditem.subItem;
        }
        
        return N;
    }
    
    // start download of item, return false if fail to initialize, used only in addDownloadWork that marks failed to init items
    
    function downloadItemStart(download) {
    
        var baseFileFolder = options.baseFolder;        
        if (!baseFileFolder) baseFileFolder = '';
        
        if (baseFileFolder) {
            baseFileFolder += '/';
        }
        
        if (!handler.initDownloadItemFile(download)) {                              
            handler.updateStateForImageGrid();
            return false;
        }
                
        var downloadOptions = {
            filename : baseFileFolder + download.filename + '.' + download.ext, 
            conflictAction : download.conflictAction,
            method : 'GET',
        }
        
        toTxtLog('DOWNLOADID ' + download.id + ' | download : ' + downloadOptions.filename);
        
        // download of Blob data throw browser download API started, next catch changes throw onDownloadProcessChanged method until comlete state
                
        var onDownloadApiStart = function(response){
                
            if (!response.downloadId || response.downloadId < 0) {
                               
                toTxtLog('DOWNLOADID ' + download.id + ' | download REJECTED by browser API : ' + downloadOptions.filename);
                toTxtLog('DOWNLOADID ' + download.id + ' | error : ' + response.error + "\n\r");
                                
                if (mode != 'download') { 
                    toTxtLog('DOWNLOADID ' + download.id + ' | downloading failed, ALSO user CANCEL downloading process.');
                    return;
                }
                
                addFailItem(download, 'Ошибка загрузки ' + (response.error ? ' : ' + response.error : ''));
                
                resetItem(download);
                
                download.workedout = true;
                download.error = response.error;
                
                handler.onDownloadEnd(download);  
                
                updateProgressBar();
                handler.updateStateForImageGrid();
                
            } else {            

                toTxtLog('DOWNLOADID ' + download.id + ' | download ACCEPTED by browser API : ' + downloadOptions.filename);
                
                if (mode != 'download') { // perhaps promise was sended after cancel ?
                
                    // download not needed
                    toTxtLog('DOWNLOADID ' + download.id + ' | downloading start, but user CANCEL downloading process. SEND REJECT TO API for file : ' + downloadOptions.filename);
                     
                    KellyTools.getBrowser().runtime.sendMessage({method: "downloads.cancel", downloadId : response.downloadId}, function(response) {});
                    
                    return;
                }
                    
                downloadingIds.push(response.downloadId);                
                KellyTools.log('DOWNLOADID ' + download.id + ' | new downloading process ' + response.downloadId, 'KellyGrabber');
                
                download.downloadId = response.downloadId;                    
                handler.updateStateForImageGrid();
            }			
        }
                
        var onLoadFile = function(url, fileData, errorCode, errorNotice) {
            
            if (mode != 'download') return false;
            
            download.dataRequest = false;
            
            if (!fileData) {
            
                // get DATA ARRAY OR BLOB fail, download as url - bad way, due to copyright marks, so call onDownloadApi event with error
                
                /*
                    toTxtLog('file NOT LOADED as DATA ARRAY OR BLOB ' + download.url + ', attempt to download by download api without DATA ARRAY OR BLOB - BAD HEADERS : ' + downloadOptions.filename);
                    toTxtLog('LOAD FAIL NOTICE error code ' + errorCode + ', message : ' + errorNotice);
                
                    KellyTools.log('onLoadFile : bad blob data for download ' + download.url + '; error : ' + errorCode + ' | error message : ' + errorNotice);
                        
                    downloadOptions.url = download.url;
                    handler.downloadUrl(downloadOptions, onDownloadApiStart);
                */
                
                toTxtLog('DOWNLOADID ' + download.id + ' | file NOT LOADED as DATA ARRAY OR BLOB ' + download.url + ' : ' + downloadOptions.filename);
                toTxtLog('DOWNLOADID ' + download.id + ' | LOAD FAIL NOTICE error code ' + errorCode + ', message : ' + errorNotice);

                onDownloadApiStart({downloadId : false, error : 'DATA ARRAY get fail. Error code : ' + errorCode + ' |  error message : ' + errorNotice});                
                
            } else {
                
                toTxtLog('DOWNLOADID ' + download.id + ' | file LOADED as DATA ARRAY OR BLOB ' + download.url + ', send to browser API for save to folder : ' + downloadOptions.filename);                
                downloadOptions.url = fileData;     

                handler.downloadUrl(downloadOptions, onDownloadApiStart);
            }
        }
        
        if (options.skipDownloaded) {
            
            // search by file name. todo may be some other search methods
            
            var onSearch = function(response) {
                   
                download.dataRequest = false;
            
                // process stoped \ canceled by timeout
                if (mode != 'download') return false;
            
                if (response && response.matchResults && response.matchResults[0].match && response.matchResults[0].match.state == 'complete') {
                                        
                    download.downloadDelta = response.matchResults[0].match;
                    download.downloadDelta.found = true;
                    download.downloadDelta.state = {current : download.downloadDelta.state};
                           
                    if (download.cancelTimer) {
                        clearTimeout(download.cancelTimer);
                        download.cancelTimer = false;
                    }
                     
                    download.workedout = true;
                    
                    updateProgressBar();
                    handler.onDownloadEnd(download);
                    
                    toTxtLog('DOWNLOADID ' + download.id + ' | SKIPPED - ALREADY Downloaded');
                                        
                    handler.updateStateForImageGrid();

                } else {
                    
                    download.dataRequest = handler.getDataFromUrl(download.url, onLoadFile);
        
                }
            } 
             
            KellyTools.getBrowser().runtime.sendMessage({
                method: "isFilesDownloaded", 
                filenames : [downloadOptions.filename] // download.filename - filename, downloadOptions.filename - full path with extension 
            }, onSearch);            
            
            download.dataRequest = {
                abort : function() {
                    onSearch = function() {} // is terminate method for search action exist ?
                }
            }
        
            
        } else {
                        
            download.dataRequest = handler.getDataFromUrl(download.url, onLoadFile);    
        }
                
        if (events.onDownloadStart) events.onDownloadStart(download);
        return true;
    }
       
    // count elements
    // type = 'complete' - count ready downloaded items
    // type = 'wait'  - count in order to download items (elements at work not included)
    
    this.countCurrent = function(type) {
        
        if (!type) {
            type = 'wait';
        } 
        
        var count = 0;
        
        for (var i = 0; i <= downloads.length-1; ++i) { 
        
            if (handler.getDownloadItemState(downloads[i]) != type) continue;
            count++;            
        }
        
        return count;
    }
    
    this.addDownloadWork = function() {
        
        if (mode != 'download') return false;
                
        var addCancelTimer = function(downloadItem) {
            
            downloadItem.cancelTimer = setTimeout(function() {
                
                if (!downloadItem) return;
                
                var endSync = true;
                if (handler.getDownloadItemState(downloads[i]) == 'in_progress') {
                     
                    toTxtLog('DOWNLOADID ' + downloadItem.id + ' | CANCELED BY TIMEOUT ' + downloadItem.url + ', ' + downloadItem.filename);
                            
                    if (downloads[i].dataRequest) {                
                        downloads[i].dataRequest.abort();  
                        downloads[i].dataRequest = false;
                    }
                    
                    if (downloadItem.downloadId > 0) {                    
                        KellyTools.getBrowser().runtime.sendMessage({method: "downloads.cancel", downloadId : downloadItem.downloadId}, function(response) {   
                        
                            downloadItem.canceling = false;	
                            downloadItem.workedout = true; 

                            handler.onDownloadEnd(downloadItem);                            
                            handler.updateStateForImageGrid();
                        });  

                        endSync = false;
                    }
                }
                
                resetItem(downloadItem);
                           
                downloadItem.error = 'Canceled by timeout';	
                downloadItem.canceling = true;                
                
                addFailItem(downloadItem, 'Завершена по таймауту');
                
                if (endSync) handler.onDownloadEnd(downloadItem);
                       
                handler.updateStateForImageGrid();
                 
                
            }, options.cancelTimer * 1000);
        }
        
        var searchWorkErrorsLimit = 20;
        var currentWork = handler.countCurrent('in_progress'); 
        var newWorkNum = options.maxDownloadsAtTime - currentWork; 
        
        if (currentWork >= options.maxDownloadsAtTime) {
            return;
        } 
        
        for (var i = downloadsOffset; i <= downloads.length - 1; i++) {
            
            if (handler.getDownloadItemState(downloads[i]) != 'wait') continue;
            
            var downloadItem = downloads[i];
            
            downloadItem.downloadId = KellyGrabber.DOWNLOADID_GET_PROCESS;
            downloadItem.workedout = false;
                       
            if (downloadItemStart(downloadItem)) {
                
                if (!downloadItem.workedout && options.cancelTimer) {
                    addCancelTimer(downloadItem);
                }
                
                newWorkNum--;
                
            } else {
                
                // bad name template \ url \ extension - common for corrupted data
                toTxtLog('CAND INIT Download item FILENAME for N ' +  i);
                
                try {
                    
                     toTxtLog('CANT INIT Download item dump ' + JSON.stringify(downloads[i].item));
                    
                } catch (E) {
                    
                }
                
                resetItem(downloadItem);
                
                downloadItem.workedout = true;
                downloadItem.error = 'Initialize download data error';
                                    
                searchWorkErrorsLimit--;
            }
              
            if (newWorkNum <= 0 || searchWorkErrorsLimit <= 0) {
                 break;
            }           
        }   
               
        handler.updateStateForImageGrid();
        updateProcessState(); 
    }
    
    function resetItem(downloadItem) {
        
        downloadItem.workedout = false;
        downloadItem.canceling = false;
        
        if (downloadItem.cancelTimer) {
            clearTimeout(downloadItem.cancelTimer);
            downloadItem.cancelTimer = false;
        }
        
        if (downloadItem.error) downloadItem.error = false;			
        if (downloadItem.downloadDelta) downloadItem.downloadDelta = false;
        
        downloadItem.downloadId = KellyGrabber.DOWNLOADID_INACTIVE; 
        downloadItem.url = false;
        downloadItem.filename = false;
    }
    
    this.resetDownloadItems = function(keepReady) {
        
        if (!downloads.length) return false;
        
        for (var i=0; i <= downloads.length-1; ++i) {
            
            if (keepReady && handler.getDownloadItemState(downloads[i]) == 'complete') {
                continue;
            } 
            
            resetItem(downloads[i]);
        }        
    }
    
    this.download = function() {
               
        if (mode != 'wait') return false;
        
        if (!downloads.length) {
            KellyTools.log('work empty', 'KellyGrabber');
            return false;
        }
                
        acceptItems = false;               
        if (options.itemsList) {
            
            acceptItems = KellyTools.getPrintValues(options.itemsList, false, 1, downloads.length);
           
            if (!acceptItems.length) {
                acceptItems = false;
            }
           
           // KellyTools.log(acceptItems);
        }
              
        if (downloadsOffset <= 0) {
            downloadsOffset = 0;   
        } else if (downloadsOffset > downloads.length-1) {
            downloadsOffset = downloads.length-1;            
        }       
                
        if (!options.interval) options.interval = 0.1;
                     
        handler.resetDownloadItems(true);

        handler.updateStartButtonState('stop'); 
        handler.updateStateForImageGrid();
 
        if (downloadsOffset == 0) {
                
            log = '';
            failItems = [];
        }        
        
        handler.addDownloadWork();
        
        updateProgressBar();
        KellyTools.log(options, 'KellyGrabber');
        
        return true;
    }
    
 
    constructor(cfg);
}

/* Static methods and constants */

KellyGrabber.TRANSPORT_BLOB = 1001;
KellyGrabber.TRANSPORT_BLOBBASE64 = 1002;

KellyGrabber.REQUEST_IFRAME = 2001;
KellyGrabber.REQUEST_XML = 2002;

KellyGrabber.DOWNLOADID_GET_PROCESS = -1;
KellyGrabber.DOWNLOADID_INACTIVE = false;

KellyGrabber.validateDriver = function(driver) {
            
    var availableTransport = [KellyGrabber.TRANSPORT_BLOB, KellyGrabber.TRANSPORT_BLOBBASE64];          
    var availableRequest = [KellyGrabber.REQUEST_XML, KellyGrabber.REQUEST_IFRAME];
    
    var defaultDriver = {
           requestMethod : availableRequest[0], 
           transportMethod : availableTransport[0],
        }
        
    if (!driver) {
        return defaultDriver;
    }
    
    driver.requestMethod = parseInt(driver.requestMethod);
    driver.transportMethod = parseInt(driver.transportMethod);
        
    if (availableRequest.indexOf(driver.requestMethod) == -1) {
     
        driver.requestMethod = defaultDriver.requestMethod;
    }
    
    if (availableTransport.indexOf(driver.transportMethod) == -1) {
 
        driver.transportMethod = defaultDriver.transportMethod;
    }
    
    return driver;
}