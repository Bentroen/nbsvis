#[derive(Clone, Copy)]
#[repr(u8)]
pub enum ResamplerMode {
    Nearest = 0,
    Linear = 1,
    Cubic = 2,
}

#[inline(always)]
pub fn resample(mode: ResamplerMode, buffer: &[f32], pos: f32) -> f32 {
    match mode {
        ResamplerMode::Nearest => nearest(buffer, pos),
        ResamplerMode::Linear => linear(buffer, pos),
        ResamplerMode::Cubic => cubic(buffer, pos),
    }
}

#[inline(always)]
fn nearest(buffer: &[f32], pos: f32) -> f32 {
    let i = pos.round() as usize;
    buffer[i.min(buffer.len() - 1)]
}

#[inline(always)]
fn linear(buffer: &[f32], pos: f32) -> f32 {
    let i0 = pos.floor() as usize;
    let i1 = (i0 + 1).min(buffer.len() - 1);
    let t = pos - i0 as f32;

    buffer[i0] * (1.0 - t) + buffer[i1] * t
}

#[inline(always)]
fn cubic(buffer: &[f32], pos: f32) -> f32 {
    let i1 = pos.floor() as isize;
    let t = pos - i1 as f32;

    let len = buffer.len() as isize;

    let i0 = (i1 - 1).clamp(0, len - 1);
    let i2 = (i1 + 1).clamp(0, len - 1);
    let i3 = (i1 + 2).clamp(0, len - 1);

    let y0 = buffer[i0 as usize];
    let y1 = buffer[i1 as usize];
    let y2 = buffer[i2 as usize];
    let y3 = buffer[i3 as usize];

    let a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    let b = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    let c = -0.5 * y0 + 0.5 * y2;
    let d = y1;

    ((a * t + b) * t + c) * t + d
}
