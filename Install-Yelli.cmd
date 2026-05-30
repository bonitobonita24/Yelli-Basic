@echo off
REM Yelli LAN  -  one-click Windows installer.
REM Double-click this file. UAC will prompt once. Everything else is automatic.
REM Requires Windows 10 1809+ (for winget) and internet access on first install.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0Install-Yelli.ps1'"
