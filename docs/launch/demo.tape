# vhs tape — terminal recording for the launch GIF
#
# Usage:
#   1. install vhs:           https://github.com/charmbracelet/vhs (brew install vhs / scoop install vhs)
#   2. install ttyd + ffmpeg if vhs warns; it tells you what's missing
#   3. from the repo root:    vhs docs/launch/demo.tape
#   4. result lands at:       docs/launch/demo.gif
#
# Tweak `Sleep` values if your machine is slower than the comfort speed.

Output docs/launch/demo.gif

Set Shell "bash"
Set FontFamily "JetBrains Mono"
Set FontSize 14
Set Width 1280
Set Height 720
Set Theme { "background": "#000510", "foreground": "#d6ecf6", "cursor": "#4db4dc", "black": "#06121f", "red": "#ff6b8a", "green": "#7be0a4", "yellow": "#f6c360", "blue": "#4db4dc", "magenta": "#7fd0ee", "cyan": "#4db4dc", "white": "#d6ecf6", "brightBlack": "#3d5a6e", "brightRed": "#ff6b8a", "brightGreen": "#7be0a4", "brightYellow": "#f6c360", "brightBlue": "#7fd0ee", "brightMagenta": "#7fd0ee", "brightCyan": "#7fd0ee", "brightWhite": "#ffffff" }
Set Padding 24
Set Margin 0
Set MarginFill "#000510"
Set BorderRadius 12
Set TypingSpeed 60ms
Set PlaybackSpeed 1.0

# settle on a clean prompt
Hide
Type "clear"
Enter
Show

# the actual demo
Type "npx wardn demo --fast"
Sleep 400ms
Enter

# wardn demo prints its sandbox banner + four attempts.
# --fast skips the 400ms per-step pause; total runtime is ~5s.
Sleep 7s

# hold the final frame so the GIF ends on the "4/4 attempts blocked" line.
Sleep 2s
