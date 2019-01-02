@echo off
data\fciv checksum.bat -wp -md5 > checksum.txt
data\fciv data/gift99a.csv -wp -md5 >> checksum.txt
data\fciv data/gift99b.csv -wp -md5 >> checksum.txt
data\fciv data/user99.csv -wp -md5 >> checksum.txt
data\fciv data/ps.csv -wp -md5 >> checksum.txt
data\fciv javascript/config.js -wp -md5 >> checksum.txt
data\fciv javascript/controller.js -wp -md5 >> checksum.txt
data\fciv javascript/pokemon.drawmode.js -wp -md5 >> checksum.txt
data\fciv javascript/vr.drawmode.js -wp -md5 >> checksum.txt
data\fciv index.html -wp -md5 >> checksum.txt
if exist %1 fciv %1 -wp -md5 >> checksum.txt
findstr ^[a-z0-9]$ checksum.txt
pause
del checksum.txt
