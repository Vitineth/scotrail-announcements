let isInBuilderMode = false;

const playSVG = document.querySelector('#play');
const pauseSVG = document.querySelector('#pause');
const playPauseButton = document.querySelector('#play-pause-button');
const stopButton = document.querySelector("#stop-button");
const playerName = document.querySelector("#player-name");
const player = document.querySelector("#player");
const builder = document.querySelector("#builder");
const builderContainer = document.querySelector('#builder-tools');
const builderClips = document.querySelector('#builder-clips');
let eventCache = [];

function bindPlayer(instance, name){
    instance.on('loaderror', (id, error) => {
        playerName.textContent = `Error: failed to load sound: ${error}`;
    });

    instance.on('playerror', (id, error) => {
        playerName.textContent = `Error: failed to play sound: ${error}`;
    });

    instance.on('play', () => {
        playSVG.style.display = 'none';
        pauseSVG.style.display = 'block';
        player.style.display = 'block';
        playerName.textContent = name;
    });

    instance.on('end', () => {
        playSVG.style.display = 'block';
        pauseSVG.style.display = 'none';
    });

    instance.on('pause', () => {
        playSVG.style.display = 'block';
        pauseSVG.style.display = 'none';
    });

    instance.on('stop', () => {
        player.style.display = 'none';
        playerName.textContent = 'Nothing playing';
    });

    const playPause = () => {
        if(instance.playing()) instance.pause();
        else instance.play();
    };
    const stop = () => {
        instance.stop();
    };

    eventCache.forEach(([entity, listener]) => {
        if(entity === 'stop') stopButton.removeEventListener('click', listener);
        else playPauseButton.removeEventListener('click', listener);
    });
    eventCache = [
        ['stop', stop],
        ['playPause', playPause],
    ];

    playPauseButton.addEventListener('click', playPause);
    stopButton.addEventListener('click', stop);
}

builderContainer.querySelector('#builder-play').addEventListener('click', () => {
    const files = [...builderClips.children].map((e) => [
        e.textContent.substring(0, e.textContent.length - 1),
        `${SOUND_ROOT}/${e.getAttribute('data-file')}`
    ]);
    if(files.length === 0) return;

    function loop(index){
        const instance = new Howl({
            src: [files[index][1]],
            autoplay: true,
            loop: false,
            preload: true,
        });

        bindPlayer(instance, toName(files[index][0], files[index][1]));
        
        instance.on('end', () => {
            if(index + 1 < files.length){
                loop(index + 1);
            }
        });
    }

    loop(0);
});

builder.addEventListener('change', () => {
    if(builder.checked){
        isInBuilderMode = true;
        enableBuilderMode();
    }else{
        isInBuilderMode = false;
        disableBuilderMode();
    }
});

function enableBuilderMode(){
    builderContainer.style.display = 'block';
    document.querySelectorAll('button.none').forEach((e) => e.textContent = 'Add');
    document.querySelectorAll('button.start').forEach((e) => e.textContent = 'Add Start');
    document.querySelectorAll('button.middle').forEach((e) => e.textContent = 'Add Middle');
    document.querySelectorAll('button.end').forEach((e) => e.textContent = 'Add End');
}

function disableBuilderMode(){
    builderContainer.style.display = 'none';
    document.querySelectorAll('button.none').forEach((e) => e.textContent = 'Recording');
    document.querySelectorAll('button.start').forEach((e) => e.textContent = 'Start');
    document.querySelectorAll('button.middle').forEach((e) => e.textContent = 'Middle');
    document.querySelectorAll('button.end').forEach((e) => e.textContent = 'End');
}

function element(element, classes, text, attrs, children){
    const d = document.createElement(element);
    
    if(classes) classes.forEach((v) => d.classList.add(v));
    if(text) d.textContent = text;

    if(children === undefined && Array.isArray(attrs)){
        // div(classes, text, children)
        d.append(...attrs);
    }else{
        // div(classes, text, attrs, children)
        if(attrs) Object.entries(attrs).forEach(([key, value]) => d.setAttribute(key, value));
        if(children) d.append(...children);
    }

    return d;
}

function div(classes, text, attrs, children){
    return element('div', classes, text, attrs, children);
}

function button(classes, text, attrs, children, onClick){
    const b = element('button', classes, text, attrs, children);
    if(onClick) b.addEventListener('click', onClick);
    return b;
}

function toName(transcription, file){
    const MAX_LENGTH = 30;
    if(transcription.length > MAX_LENGTH){
        return `${transcription.substr(0, MAX_LENGTH - 3)}... (${file})`;
    }else{
        return `${transcription} (${file})`;
    }
}

const SOUND_ROOT = 'announcements';

function playClip(file, name){
    console.log('trying to play clip', file);
    const sound = new Howl({
        src: [`${SOUND_ROOT}/${file}`],
        autoplay: true,
        loop: false,
        preload: true,
    });
    bindPlayer(sound, name);
}

function handlePlayClip(file, name, transcription){
    return () => {
        if(isInBuilderMode){
            const element = div(['entry'], undefined, {'data-file': file}, [
                transcription,
                button([], 'X', undefined, undefined, () => element.remove()),
            ]);
            builderClips.append(element);
        }else{
            playClip(file, name);
        }
    }
}

function makeCard(id, transcription, start, middle, end, none){
    let base = [];
    if(none){
        base = [
            button(['none', 'box-button'], 'Recording', undefined, undefined, handlePlayClip(none, toName(transcription, none), transcription)),
        ]
    }else{
        base = [
            button(['start', 'box-button'], 'Start', start ? {} : {disabled: true}, undefined, handlePlayClip(start, toName(transcription, start), transcription)),
            button(['middle', 'box-button'], 'Middle', middle ? {} : {disabled: true}, undefined, handlePlayClip(middle, toName(transcription, middle), transcription)),
            button(['end', 'box-button'], 'End', end ? {} : {disabled: true}, undefined, handlePlayClip(end, toName(transcription, end), transcription)),
        ];
    }
    return div(['card'], undefined, {'data-id': id}, [
        div(['upper'], transcription),
        div(['lower'], undefined, undefined, base),
    ]);
}

fetch('/clips.json').then((d) => d.json())
.then((clips) => {
    console.log(clips);

    const documents = clips.map((e, i) => {
        e.id = i;
        return {
            ref: i,
            text: e.transcription,
        };
    });
    const index = lunr((builder) => {
        builder.ref('ref');
        builder.field('text');
    
        documents.forEach((e) => builder.add(e));
    });

    let activeID;
    function debounce(func){
        if(activeID) clearTimeout(activeID);
        activeID = setTimeout(func, 300);
    }

    function debounced(func){
        return () => debounce(func);
    }

    console.log(index.search('carriage'));
    const inputField = document.querySelector('input');
    inputField.addEventListener('input', debounced(() => {
        const value = inputField.value;
        const cards = document.querySelectorAll('.card');
        if(value.length === 0){
            cards.forEach((e) => e.style.display = 'block');
        }else{
            cards.forEach((e) => e.style.display = 'none');
            const matches = index.search(inputField.value).map((e) => e.ref);
    
            cards.forEach((v) => {
                const id = v.getAttribute('data-id');
                if(matches.includes(id)) v.style.display = 'block';
            })
        }
    }))

    const generated = clips
        .map((v) => makeCard(v.id, v.transcription, v.start?.file, v.middle?.file, v.end?.file, v.none?.file));
    document.querySelector('#cards').append(...generated);
}).catch((e) => {
    console.error(e);
    alert("Failed to load clips!");
    // TODO: better error handling
});