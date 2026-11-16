# Wrecking Room

**Breaking things is the easy part.**

Wrecking Room is a first-person browser game from Real Estate Makeover Co. Walk through a furnished apartment and swing a sledgehammer at walls, doors, windows, and furniture. Materials break and sound different, and loose items fall when you take out what holds them up.

## Controls

| Platform | Move | Look | Swing | Pause |
| --- | --- | --- | --- | --- |
| Desktop | WASD or arrow keys | Mouse | Left click or Space | Esc |
| Phone | Left joystick | Swipe on the right side | Swing button | Pause button |

Select **Restart** in the pause menu to restore the apartment.

## Run locally

Serve this folder over HTTP and open `http://localhost:8000` in a browser with WebGL 2.

```sh
python3 -m http.server 8000
```

The game is a static site. There is no build step. For GitHub Pages, configure the repository to deploy from the root of its `main` branch.

The bundled Three.js library is distributed under the [MIT License](LICENSE-three.txt).
