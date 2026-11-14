cd ~/smart-mirror && SDL_VIDEODRIVER=wayland WAYLAND_DISPLAY=wayland-0 ~/mirror-venv/bin/python run_mirror.py


cd ~/smart-mirror && ~/mirror-venv/bin/python calibrate_floor.py --camera-height 1.55
