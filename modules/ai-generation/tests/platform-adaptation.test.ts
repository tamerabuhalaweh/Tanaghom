import { describe, it, expect } from 'vitest';
import { PLATFORM_CONSTRAINTS } from '../types';
import type { Platform } from '../types';

describe('Platform Adaptation', () => {
  it('all 7 platforms have constraints defined', () => {
    const platforms = Object.keys(PLATFORM_CONSTRAINTS);
    expect(platforms).toHaveLength(7);
    expect(platforms).toContain('linkedin');
    expect(platforms).toContain('instagram');
    expect(platforms).toContain('x');
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('tiktok');
    expect(platforms).toContain('youtube');
    expect(platforms).toContain('reddit');
  });

  it('LinkedIn has professional constraints', () => {
    const li = PLATFORM_CONSTRAINTS.linkedin;
    expect(li.maxTextLength).toBe(1300);
    expect(li.maxHashtags).toBe(5);
    expect(li.recommendedFormat).toBe('post');
    expect(li.hookRequired).toBe(true);
  });

  it('X has short-form constraints', () => {
    const x = PLATFORM_CONSTRAINTS.x;
    expect(x.maxTextLength).toBe(280);
    expect(x.maxHashtags).toBe(2);
    expect(x.hookRequired).toBe(true);
  });

  it('Instagram prioritizes Reels', () => {
    const ig = PLATFORM_CONSTRAINTS.instagram;
    expect(ig.recommendedFormat).toBe('reel');
    expect(ig.hookRequired).toBe(true);
  });

  it('Reddit has no hashtags', () => {
    const reddit = PLATFORM_CONSTRAINTS.reddit;
    expect(reddit.maxHashtags).toBe(0);
    expect(reddit.hookRequired).toBe(false);
  });

  it('Facebook is community-focused', () => {
    const fb = PLATFORM_CONSTRAINTS.facebook;
    expect(fb.notes).toContain('Community-focused');
    expect(fb.hookRequired).toBe(false);
  });

  it('TikTok is video-first', () => {
    const tt = PLATFORM_CONSTRAINTS.tiktok;
    expect(tt.recommendedFormat).toBe('reel');
    expect(tt.notes).toContain('Video-first');
  });

  it('YouTube supports long-form', () => {
    const yt = PLATFORM_CONSTRAINTS.youtube;
    expect(yt.maxTextLength).toBe(5000);
    expect(yt.maxHashtags).toBe(15);
    expect(yt.recommendedFormat).toBe('video');
  });

  it('each platform has unique constraints', () => {
    const platforms = Object.values(PLATFORM_CONSTRAINTS);
    const lengths = platforms.map((p) => p.maxTextLength);
    const uniqueLengths = new Set(lengths);
    // At least some platforms should have different max lengths
    expect(uniqueLengths.size).toBeGreaterThan(1);
  });
});
