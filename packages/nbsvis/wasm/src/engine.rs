use crate::resampler::{sample, ResamplerMode};
use crate::voice::Voice;
use wasm_bindgen::prelude::*;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct EngineMetrics {
    pub active_voices: u32,
    pub max_voices: u32,
    pub dropped_voices: u32,
}

#[wasm_bindgen]
pub struct Engine {
    voices: Vec<Voice>,
    max_voices: usize,

    // metrics
    active_voices: usize,
    dropped_voices: usize,

    // policy
    resampler: ResamplerMode,

    // samples
    sample_atlas: Vec<f32>,
    sample_offsets: Vec<usize>,
    sample_lengths: Vec<usize>,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new(max_voices: usize) -> Engine {
        Engine {
            voices: Vec::with_capacity(max_voices),
            max_voices,

            active_voices: 0,
            dropped_voices: 0,
            resampler: ResamplerMode::Cubic,

            sample_atlas: Vec::new(),
            sample_offsets: Vec::new(),
            sample_lengths: Vec::new(),
        }
    }

    pub fn set_sample_atlas(&mut self, atlas: &[f32], offsets: &[usize], lengths: &[usize]) {
        self.sample_atlas.clear();
        self.sample_atlas.extend_from_slice(atlas);

        self.sample_offsets.clear();
        self.sample_offsets.extend_from_slice(offsets);

        self.sample_lengths.clear();
        self.sample_lengths.extend_from_slice(lengths);
    }

    pub fn spawn(&mut self, sample_id: usize, gain: f32, pan: f32, pitch: f32) {
        if self.voices.len() >= self.max_voices {
            self.voices.remove(0); // basic voice stealing
            self.dropped_voices += 1;
        }

        let gain_l = gain * (1.0 - pan) * 0.5;
        let gain_r = gain * (1.0 + pan) * 0.5;

        self.voices.push(Voice {
            sample_id,
            position: 0.0,
            gain_l,
            gain_r,
            step: pitch,
        });
    }

    #[wasm_bindgen]
    pub fn set_max_voices(&mut self, max: usize) {
        self.max_voices = max;
        if self.voices.len() > max {
            let excess = self.voices.len() - max;
            self.voices.drain(0..excess);
            self.dropped_voices += excess;
        }
    }

    #[wasm_bindgen]
    pub fn kill_ratio(&mut self, ratio: f32) {
        let kill = ((self.voices.len() as f32) * ratio).floor() as usize;
        self.voices.drain(0..kill);
        self.dropped_voices += kill;
    }

    pub fn active_count(&self) -> usize {
        self.voices.len()
    }

    #[wasm_bindgen]
    pub fn set_resampler(&mut self, mode: u8) {
        self.resampler = match mode {
            0 => ResamplerMode::Nearest,
            1 => ResamplerMode::Linear,
            _ => ResamplerMode::Cubic,
        };
    }

    #[wasm_bindgen]
    pub fn get_metrics(&self) -> EngineMetrics {
        EngineMetrics {
            active_voices: self.active_voices as u32,
            max_voices: self.max_voices as u32,
            dropped_voices: self.dropped_voices as u32,
        }
    }

    pub fn render(&mut self, output_l: &mut [f32], output_r: &mut [f32]) {
        let frames = output_l.len();

        for voice in &mut self.voices {
            let sample_id = voice.sample_id;

            if sample_id >= self.sample_offsets.len() {
                continue;
            }

            let offset = self.sample_offsets[sample_id];
            let length = self.sample_lengths[sample_id];

            let sample = &self.sample_atlas[offset..offset + length];

            let mut pos = voice.position;

            for i in 0..frames {
                let idx = pos as usize;

                if idx >= length {
                    break;
                }

                let s = self.sample_atlas[offset + idx];

                output_l[i] += s * voice.gain_l;
                output_r[i] += s * voice.gain_r;

                pos += voice.step;
            }

            voice.position = pos;
        }

        // Remove finished voices
        self.voices.retain(|v| {
            let id = v.sample_id;

            if id >= self.sample_lengths.len() {
                return false;
            }

            let length = self.sample_lengths[id];
            (v.position as usize) < length
        });

        self.active_voices = self.voices.len();
    }
}
