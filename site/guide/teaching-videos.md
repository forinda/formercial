# Making teaching videos

A good teaching video changes what someone can do afterwards. This guide turns research on how adults learn into a repeatable plan for a lesson in Formercial. It suits doodles best, but it works with any kind of scene.

## The lesson pattern

Plan each video around one concept, with these parts in order:

| Part | What the viewer gets | Why |
| --- | --- | --- |
| **Hook** | A real question or puzzle | Gives them a problem to solve |
| **Why it matters** | The life or work problem this solves | Adults want to know why before they commit their time |
| **Try it first** | A small task, before any explanation | Trying first prepares them for the explanation |
| **Reflect** | "What did you notice?" | Connects the task to what they already know |
| **The idea** | The explanation, in short sections | The rule makes sense because they've met the problem |
| **Challenge** | A new problem, in their own context, with a cue to pause | They apply the idea without your help, before they see the answer |
| **Check** | The answer, or a way to verify it | They can correct mistakes while the problem is still fresh |

The pattern sets the order, not the words. If every video opens with "Why does this matter to you?" and closes with "Here's your challenge", it starts to sound like a template, and viewers tune out. Keep what each part does, but say it differently each time: "So why draw at all?" does the same job, and sounds like a person talking.

## Build it in Formercial

1. **Start from a lesson preset.** Each one teaches one thing using this pattern, and its stage scenes are named `hook`, `why`, `try`, `reflect`, `challenge` and `check`, so you can see what to replace. Each preset words these moments differently, to show that it can be done:

   ```bash
   pnpm kick formercial new "My lesson" --preset doodle-light-bulb
   ```

   For a code lesson, use `javascript-const-let` or `typescript-types`. To draw the ideas and then show the code, use `python-objects`.

2. **Write one idea per scene.** Put the narration in `spoken`. Short scenes are easy to reorder, cut and reuse.

3. **Generate the voice before you time the drawings.** Then set `at` on each stroke, so it appears as the matching word is spoken. See [Doodle videos](./doodles#tips).

   ```bash
   pnpm kick formercial voice my-lesson
   ```

4. **Leave real time for pause moments.** A scene lasts at least as long as its voice, or as long as `minSeconds` if that's longer. So on a "try it first" or challenge scene, ask viewers to pause, and set `minSeconds` to a few seconds more than the clip. Captions end with the voice, so put the prompt in a block to keep it on screen:

   ```json
   {
     "id": "try-it",
     "kind": "blocks",
     "minSeconds": 20,
     "caption": "Pause the video, and write down your guess.",
     "spoken": "Pause the video, and write down your guess.",
     "blocks": [{ "type": "headline", "text": "Write down your guess." }]
   }
   ```

5. **Keep captions available.** Every render also writes an `.srt` file, which you can upload to YouTube. With captions on, it's in `renders/srt/`. If burned-in captions cover your drawing, set `"captions": false`, and the file sits beside the MP4 instead.

6. **Add chapters when you publish.** Put timestamps in the video description, starting at `00:00`, so viewers can jump to what they need. The `.srt` file shows when each line starts.

7. **Render.** Long lessons take a while, so check the first minute before you render it all:

   ```bash
   pnpm kick formercial render my-lesson --format 16:9 --seconds 60
   pnpm kick formercial render my-lesson --format 16:9
   ```

## Checklist

- [ ] The video teaches one concept, and you can name it in one sentence.
- [ ] The opening names a real problem the viewer has.
- [ ] Viewers try something before you explain it.
- [ ] New ideas connect to something they already know.
- [ ] The challenge is a new problem, not a repeat of your example.
- [ ] Viewers are told to pause before the answer appears.
- [ ] Viewers can check their answer straight away.
- [ ] The recurring moments don't reuse the wording of your other videos.
- [ ] Chapters let experienced viewers skip ahead.
- [ ] Every label is readable on a phone.
- [ ] Captions are burned in or uploaded.

## What the research says

Treat these ideas as design guidance, not laws. The strength of the evidence varies a lot.

| Idea | What it says | How strong it is |
| --- | --- | --- |
| **Andragogy** (Knowles) | Adults want to know why, direct themselves, draw on experience, learn when it's relevant, focus on problems, and are motivated from within | A useful guide, but critics point to [limited empirical evidence and overgeneralisation](https://infed.org/mobi/?p=2909). Younger learners benefit from many of the same things, and it may not fit every culture. |
| **Experiential learning cycle** (Kolb) | Learn by experiencing, reflecting, forming a rule and testing it | A sensible way to structure a lesson. Don't sort viewers into Kolb's "learner types": a major review found [no adequate evidence for teaching to learning styles](https://doi.org/10.1111/j.1539-6053.2009.01038.x). |
| **Short videos** | In a study of 862 edX videos, [engagement dropped sharply after about 6 minutes](https://up.csail.mit.edu/other-pubs/las2014-pguo-engagement.pdf) | Strong for watch time, but that measures engagement, not learning. |
| **Segmenting** | Splitting material into segments improves learning, with [small to medium effects on retention and transfer](https://is.tuebingen.mpg.de/publications/rey2018segmenting) | Solid: a meta-analysis of 56 investigations. It doesn't set a best length. |
| **Problem first** | Solving a problem before instruction [can beat instruction first](https://doi.org/10.3102/00346543211019105) | Strong, in a meta-analysis of 53 studies. Check how well it carries over to video, since a viewer can skip the attempt. |
| **Retrieval practice** | [Testing yourself beats restudying](https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf) on delayed tests, even though restudying feels more effective | Strong and widely replicated. |
| **Spaced practice** | [Spreading practice out helps retention](https://pubmed.ncbi.nlm.nih.gov/16719566/), and the best gap depends on how long you need to remember | Strong, based on 317 experiments on verbal recall. Revisiting earlier ideas in later videos applies it. |
| **Feedback** | One of the [most powerful influences on learning, but it can help or harm](https://www.uky.edu/~gmswan3/575/Hattie_Timperly_2007.pdf) | Strong overall, but findings on immediate versus delayed feedback are mixed. Giving the answer in the video is a practical default, not a proven best. |

A video can't watch how someone responds. So the pause, the challenge and the check matter most: they're what get viewers doing something rather than only watching.
