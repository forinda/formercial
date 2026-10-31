---
layout: home

hero:
  name: Formercial
  text: Short product commercials, made like code.
  tagline: Put scenes together in an editor, hear them as you edit, and render MP4s in 16:9, 9:16 and 1:1. On your own machine, in plain files.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Configuration
      link: /reference/configuration

features:
  - title: Scenes from blocks, or from code
    details: Headlines, code that types itself, terminals, file trees, cards and end cards, set in a form. When those aren't enough, write the scene's HTML, CSS and a draw(t) function.
  - title: A voice that fits the scene
    details: Generate each line with a neural voice, or record it yourself in the browser. Scenes last as long as their lines, so nothing is cut off.
  - title: Preview is the render
    details: The live preview and the final render run the same player, so what you watch is what you get, frame for frame.
  - title: Three shapes from one project
    details: Landscape, vertical and square from the same scenes. Blocks re-flow, busy scenes zoom to fit, captions keep their own band.
  - title: Plain files, scriptable
    details: A commercial is a folder with project.json and its media. Write one from a script, render it with kick formercial, commit it to git.
  - title: Bring your own pipeline
    details: Rendering and voice are drivers. Plug in a GPU encoder, a render farm or another speech engine without touching the app.
---
<script setup>
import { withBase } from 'vitepress'
</script>

<div id="intro" style="max-width: 880px; margin: 48px auto 0">

<h2 style="margin-bottom: 16px; border: 0; padding: 0">See what it can do</h2>

<video controls preload="metadata" playsinline :poster="withBase('/formercial-intro.jpg')" :src="withBase('/formercial-intro.mp4')" style="width: 100%; border-radius: 8px" aria-label="A 100-second introduction to Formercial, with captions, made with Formercial"></video>

<p>A 100-second tour, made with Formercial itself.</p>

</div>

