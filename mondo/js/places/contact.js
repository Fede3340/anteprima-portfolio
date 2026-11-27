import { element, playback, sceneVideo } from '../media.js';

const LINKS = [
  ['LinkedIn', 'https://www.linkedin.com/in/federicomascia'],
  ['Instagram', 'https://www.instagram.com/federico__mascia'],
];

// The paper plane, and where to write.
export function createContact({ root }) {
  const video = sceneVideo('contact');
  root.append(
    element('div', { className: 'contact__scene' }, [element('div', { className: 'cover' }, [video])]),
    element('div', { className: 'contact' }, [
      element('h2', { className: 'contact__title', textContent: 'Scrivimi' }),
      element('ul', { className: 'contact__links' }, LINKS.map(([name, href]) => element('li', {}, [
        element('a', { href, target: '_blank', rel: 'noopener', textContent: name }),
      ]))),
    ]),
  );
  playback.want(video, true);
  return {
    ready: Promise.resolve(),
    leave: () => playback.forget(video),
  };
}
