@echo off
pushd "%~1"
SET frontend=khelper.user.js
SET background=khelper.bg.js
SET debug=0

break>%frontend%
:: or echo.>%frontend% to clear file before write
copy %frontend% + "%~dp0\SIGN" %frontend%

:: for \r 
for %%x in (
    "widget\kellyTooltip.js"  
    "widget\kellyTileGrid.js" 
    "widget\kellyImageView.js" 
    "lib\kellyLoc.js"	
    "lib\kellyStorageManager.js"	 
    "lib\kellyThreadWork.js" 
    "lib\kellyGrabber.js" 
    "lib\kellyFastSave.js" 
    "lib\kellyTools.js"
    "lib\kellyOptions.js"
    "lib\kellyFavItems.js"
    "env\profiles\joyreactor.js" 
) do (

    @echo.>> %frontend%
    @echo.>> %frontend%
    @echo.>> %frontend%
    @echo // EXTRACTED FROM FILE %%~x>> %frontend%
    @echo.>> %frontend%
    @echo.>> %frontend%
    @echo.>> %frontend%
    
    copy %frontend% + "%~dp0\%%~x" %frontend%
)

@echo // initialization>> %frontend%

@echo.>> %frontend%
IF "%debug%" GEQ "1" (
    @echo KellyTools.DEBUG = true;>> %frontend%
)
@echo.>> %frontend%

copy %frontend% + "%~dp0\init.js" %frontend%

@echo.>> %frontend%
@echo // end of file >> %frontend%

break>%background%
copy %background% + "%~dp0\SIGN" %background%

for %%x in ( 
    "lib\kellyTools.js" 
    "lib\kellyDispetcher.js" 
) do (
    
    @echo.>> %background%
    @echo.>> %background%
    @echo.>> %background%
    @echo // EXTRACTED FROM FILE %%~x>> %background%
    @echo.>> %background%
    @echo.>> %background%
    @echo.>> %background%
    
    copy %background% + "%~dp0\%%~x" %background%
)

@echo // initialization>> %background%

@echo.>> %background%
IF "%debug%" GEQ "1" (
    @echo KellyTools.DEBUG = true;>> %background%
)
@echo.>> %background%

copy %background% + "%~dp0\init.bg.js" %background%

@echo.>> %background%
@echo // end of file >> %background%

:: copy tmp.js + "%%~x" tmp.js > NUL
popd

:: java -jar "D:\Dropbox\Private\l scripts\jfav\jsmin\closure.jar" --js %frontend% --js_output_file khelper.user.min.js

:: pause