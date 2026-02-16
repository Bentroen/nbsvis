use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn mix_voices(
    voices: &mut [f32],
    samples: &[f32],
    out_l: &mut [f32],
    out_r: &mut [f32],
    voice_count: usize,
    block_size: usize,
) {
    let stride = 6;

    for v in 0..voice_count {
        let base = v * stride;

        let mut pos = voices[base];
        let pitch = voices[base + 1];
        let gain = voices[base + 2];
        let pan = voices[base + 3];
        let sample_offset = voices[base + 4] as usize;
        let sample_length = voices[base + 5] as usize;

        for i in 0..block_size {
            let p = pos as usize;

            if p >= sample_length {
                break;
            }

            let frac = pos - p as f32;

            let s0 = samples[sample_offset + p];
            let s1 = if p + 1 < sample_length {
                samples[sample_offset + p + 1]
            } else {
                0.0
            };

            let sample = s0 + (s1 - s0) * frac;

            out_l[i] += sample * gain * (1.0 - pan.max(0.0));
            out_r[i] += sample * gain * (1.0 + pan.min(0.0));

            pos += pitch;
        }

        voices[base] = pos;
    }
}