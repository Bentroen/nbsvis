#[derive(Clone)]
pub struct Voice {
    pub sample_id: usize,
    pub position: f32,
    pub gain_l: f32,
    pub gain_r: f32,
    pub step: f32,
}
