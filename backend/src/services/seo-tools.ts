import { env } from '../config/env';
import { logger } from '../lib/logger';
import { one, query } from '../db/pool';
import { openai } from './openai';

export const seoTools = {
  /** WhatsApp Business Bio generator */
  async whatsappBio(orgId: string, opts: { businessName: string; category: string; usp: string; city: string; phone: string }) {
    if (!openai) throw new Error('OpenAI not configured');
    const r = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are an SEO expert for Indian local businesses. Write optimized WhatsApp Business "About" bios that increase discoverability and trust. Return JSON only.' },
        { role: 'user', content: `Business: ${opts.businessName}\nCategory: ${opts.category}\nUSP: ${opts.usp}\nCity: ${opts.city}\nPhone: ${opts.phone}\n\nReturn JSON: {"bios": ["short 1", "short 2", "short 3"]} — 3 variations, each under 139 chars.` },
      ],
      temperature: 0.7, response_format: { type: 'json_object' }, max_tokens: 400,
    });
    const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
    const bios = (parsed.bios || []).join('\n\n---\n\n');

    await query(
      `INSERT INTO seo_content (org_id, content_type, prompt, output, meta) VALUES ($1,'bio',$2,$3,$4::jsonb)`,
      [orgId, opts.businessName, bios, JSON.stringify(opts)]
    );
    return { bios: parsed.bios || [] };
  },

  /** SEO-optimized product description */
  async productDescription(orgId: string, opts: { productName: string; category: string; price: string; features: string; targetAudience: string }) {
    if (!openai) throw new Error('OpenAI not configured');
    const r = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You write SEO-optimized e-commerce product descriptions for Indian D2C brands. Include keywords naturally. Return JSON only.' },
        { role: 'user', content: `Product: ${opts.productName}\nCategory: ${opts.category}\nPrice: ${opts.price}\nFeatures: ${opts.features}\nTarget audience: ${opts.targetAudience}\n\nReturn JSON: {"short": "under 60 words", "long": "200 words with bullets", "keywords": ["kw1","kw2","kw3","kw4","kw5"], "meta_title": "under 60 chars", "meta_description": "under 155 chars"}` },
      ],
      temperature: 0.6, response_format: { type: 'json_object' }, max_tokens: 800,
    });
    const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
    const output = `SHORT:\n${parsed.short}\n\nLONG:\n${parsed.long}\n\nKEYWORDS:\n${(parsed.keywords || []).join(', ')}\n\nMETA TITLE:\n${parsed.meta_title}\n\nMETA DESCRIPTION:\n${parsed.meta_description}`;

    await query(
      `INSERT INTO seo_content (org_id, content_type, prompt, output, meta) VALUES ($1,'product',$2,$3,$4::jsonb)`,
      [orgId, opts.productName, output, JSON.stringify(opts)]
    );
    return parsed;
  },

  /** Hashtag generator */
  async hashtags(orgId: string, opts: { topic: string; platform: string; count: number }) {
    if (!openai) throw new Error('OpenAI not configured');
    const r = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You generate viral Indian hashtags. Mix English + Hindi. Return JSON only.' },
        { role: 'user', content: `Topic: ${opts.topic}\nPlatform: ${opts.platform}\nCount: ${opts.count}\n\nReturn JSON: {"hashtags": ["#tag1", ...], "categories": {"trending": [...], "niche": [...], "local": [...]}}` },
      ],
      temperature: 0.8, response_format: { type: 'json_object' }, max_tokens: 400,
    });
    const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
    await query(
      `INSERT INTO seo_content (org_id, content_type, prompt, output, meta) VALUES ($1,'hashtag',$2,$3,$4::jsonb)`,
      [orgId, opts.topic, (parsed.hashtags || []).join(' '), JSON.stringify(opts)]
    );
    return parsed;
  },

  /** Facebook/Google ad copy */
  async adCopy(orgId: string, opts: { product: string; audience: string; goal: string; budget: string }) {
    if (!openai) throw new Error('OpenAI not configured');
    const r = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You write high-converting Facebook/Instagram ad copy for Indian SMBs. Return JSON only.' },
        { role: 'user', content: `Product: ${opts.product}\nAudience: ${opts.audience}\nGoal: ${opts.goal}\nBudget: ${opts.budget}\n\nReturn JSON: {"variations": [{"headline":"under 40 chars","primary_text":"under 125 chars","cta":"Learn More/Shop Now/etc","angle":"emotional/logical/urgency"}]} — 5 variations.` },
      ],
      temperature: 0.7, response_format: { type: 'json_object' }, max_tokens: 900,
    });
    const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
    const output = (parsed.variations || []).map((v: any) => `[${v.angle?.toUpperCase()}]\n${v.headline}\n${v.primary_text}\nCTA: ${v.cta}`).join('\n\n---\n\n');
    await query(
      `INSERT INTO seo_content (org_id, content_type, prompt, output, meta) VALUES ($1,'adcopy',$2,$3,$4::jsonb)`,
      [orgId, opts.product, output, JSON.stringify(opts)]
    );
    return parsed;
  },

  /** Google Business Profile helper */
  async googleBusiness(orgId: string, opts: { businessName: string; category: string; city: string; services: string }) {
    if (!openai) throw new Error('OpenAI not configured');
    const r = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You optimize Google Business Profile listings for Indian local businesses. Return JSON only.' },
        { role: 'user', content: `Business: ${opts.businessName}\nCategory: ${opts.category}\nCity: ${opts.city}\nServices: ${opts.services}\n\nReturn JSON: {"description": "under 750 chars", "categories": ["primary","secondary1","secondary2"], "service_keywords": ["kw1","kw2",...10], "post_ideas": ["post1", "post2", "post3"]}` },
      ],
      temperature: 0.6, response_format: { type: 'json_object' }, max_tokens: 800,
    });
    const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
    await query(
      `INSERT INTO seo_content (org_id, content_type, prompt, output, meta) VALUES ($1,'google-business',$2,$3,$4::jsonb)`,
      [orgId, opts.businessName, parsed.description || '', JSON.stringify(parsed)]
    );
    return parsed;
  },
};
