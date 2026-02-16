use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn mix_voices(
    voices: &mut [f32],   // ← make mutable!
    samples: &[f32],
    out_l: &mut [f32],
    out_r: &mut [f32],
    voice_count: usize,
    block_size: usize,
) {
    let stride = 5;

    for v in 0..voice_count {
        let base = v * stride;

        let mut pos = voices[base];
        let pitch = voices[base + 1];
        let gain = voices[base + 2];
        let pan = voices[base + 3];
        let sample_offset = voices[base + 4] as usize;

        for i in 0..block_size {
            let p = pos as usize;
            let frac = pos - p as f32;

            let s0 = samples.get(sample_offset + p).copied().unwrap_or(0.0);
            let s1 = samples.get(sample_offset + p + 1).copied().unwrap_or(0.0);

            let sample = s0 + (s1 - s0) * frac;

            out_l[i] += sample * gain * (1.0 - pan.max(0.0));
            out_r[i] += sample * gain * (1.0 + pan.min(0.0));

            pos += pitch;
        }

        // write updated position back
        voices[base] = pos;
    }
}
