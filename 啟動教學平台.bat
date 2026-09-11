@echo off
chcp 65001 >nul
title 萬能科技大學 - 創意發想與實踐 ✕ Antigravity ✕ AI Agent 教學平台

echo ======================================================================
echo   萬能科技大學【創意發想與實踐 ✕ Antigravity ✕ AI Agent】教學平台
echo   授課教師：邱俊維 博士 (Dr. Chun-Wei Chiu)
echo   開課班級：企管四系1甲 (每週一 第 6、7 節 13:00~14:45)
echo   授課地點：G104 多媒體視聽教室 (現場無學生電腦 ✕ 手機互動 ✕ 回家實踐)
echo ======================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [提示] 檢測到系統尚未安裝或配置 Python 環境。
    echo 本平台已內建免安裝單機離線版，正在為您直接開啟：平台首頁(單機離線直接點開).html
    start "" "平台首頁(單機離線直接點開).html"
    pause
    exit /b 0
)

echo [1/2] 正在為您啟動教學伺服器與開啟瀏覽器...
start "" http://localhost:5000

echo [2/2] 系統已就緒！請將講台畫面投影至大螢幕，讓全班學生用手機掃碼連線：
echo.
python app.py

pause
