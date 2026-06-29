export type CourseCampaignTemplate = {
  id: string;
  name: string;
  useCase: string;
  recommendedFor: string;
  topic: string;
  objective: string;
  audience: string;
  cta: string;
  contentType: 'campaign' | 'announcement' | 'thought_leadership' | 'event' | 'evergreen';
  riskCategory: 'low' | 'medium' | 'high';
  targetPlatforms: string[];
  mediaRequirements: string;
  expectedOutcome: string;
  recommendedFunnel: string[];
};

export type AlgorithmKnowledgeSource = {
  id: string;
  platform: string;
  title: string;
  sourceUrl: string;
  sourceType: 'official_docs' | 'official_policy' | 'open_source_reference' | 'internal_analytics';
  status: 'active_reference' | 'requires_review' | 'customer_data_required';
  importedBy: 'operator_review' | 'official_api' | 'mcp_read_only_discovery';
  lastReviewed: string;
  notes: string;
};

export type AlgorithmGuidanceRule = {
  id: string;
  platform: string;
  signal: string;
  recommendation: string;
  businessImpact: string;
  sourceId: string;
  confidence: 'low' | 'medium' | 'high';
  canInfluenceScore: boolean;
};

export const COURSE_CAMPAIGN_TEMPLATES: CourseCampaignTemplate[] = [
  {
    id: 'course_launch_waitlist',
    name: 'Course Launch Waitlist',
    useCase: 'Build demand before opening registration.',
    recommendedFor: 'New course, cohort launch, limited-seat program',
    topic: 'Launch a new transformational course and collect qualified waitlist interest.',
    objective:
      'Create demand for an upcoming course by explaining the pain point, the promised learning outcome, and the next step to join the waitlist.',
    audience:
      'Followers who already trust the personal brand and are considering structured coaching, courses, or self-development programs.',
    cta: 'Join the course waitlist or request the enrollment link.',
    contentType: 'campaign',
    riskCategory: 'medium',
    targetPlatforms: ['instagram', 'linkedin', 'x'],
    mediaRequirements:
      'Short video hook, carousel talking points, founder-facing caption, and a clear enrollment/waitlist CTA.',
    expectedOutcome: 'Qualified course-intent leads ready for CRM and SmartLabs follow-up.',
    recommendedFunnel: ['Awareness post', 'Value carousel', 'Registration reminder', 'Lead qualification', 'CRM/voice handoff'],
  },
  {
    id: 'lead_magnet_comment_keyword',
    name: 'Lead Magnet / Comment Keyword',
    useCase: 'Turn engagement into a trackable lead list.',
    recommendedFor: 'Free guide, checklist, mini-course, WhatsApp/Telegram opt-in',
    topic: 'Offer a practical free resource that captures followers interested in a paid course.',
    objective:
      'Invite followers to request a free resource, then route interested people into lead qualification and follow-up.',
    audience:
      'Followers who engage with educational posts and need a low-friction first step before buying a course.',
    cta: 'Comment the keyword or request the free resource link.',
    contentType: 'evergreen',
    riskCategory: 'medium',
    targetPlatforms: ['instagram', 'facebook', 'x'],
    mediaRequirements:
      'Short video/reel, comment keyword CTA, lead capture field mapping, and consent-friendly follow-up copy.',
    expectedOutcome: 'Captured leads with campaign attribution and qualification score.',
    recommendedFunnel: ['Hook video', 'Comment/DM interest', 'Lead capture', 'Qualification', 'GHL package'],
  },
  {
    id: 'live_event_conversion',
    name: 'Live Event Conversion',
    useCase: 'Promote a paid or free live session.',
    recommendedFor: 'Masterclass, seminar, coaching event, webinar',
    topic: 'Promote an upcoming live event and move interested followers into registration.',
    objective:
      'Explain why the live event matters now, what participants will learn, and how to reserve a seat.',
    audience:
      'Warm followers, previous attendees, and professionals looking for practical guidance from the creator.',
    cta: 'Reserve your seat for the live session.',
    contentType: 'event',
    riskCategory: 'low',
    targetPlatforms: ['instagram', 'linkedin', 'x'],
    mediaRequirements:
      'Speaker intro clip, event agenda carousel, reminder posts, registration CTA, and follow-up script.',
    expectedOutcome: 'Registrations and warm leads for SmartLabs follow-up.',
    recommendedFunnel: ['Announcement', 'Agenda value post', 'Reminder', 'Registration handoff', 'Voice/chat follow-up'],
  },
  {
    id: 'transformation_story',
    name: 'Transformation Story',
    useCase: 'Use proof-led storytelling without unsafe claims.',
    recommendedFor: 'Testimonials, alumni stories, before/after learning outcomes',
    topic: 'Share a student or customer transformation story connected to the course offer.',
    objective:
      'Tell a credible story that builds trust, shows the learning journey, and invites followers to take the next step.',
    audience:
      'Followers who need social proof before committing to a course or coaching program.',
    cta: 'Ask for the course details or book a discovery conversation.',
    contentType: 'thought_leadership',
    riskCategory: 'medium',
    targetPlatforms: ['instagram', 'linkedin', 'facebook'],
    mediaRequirements:
      'Story arc, consent note, testimonial-safe wording, carousel or reel structure, and CTA slide.',
    expectedOutcome: 'Higher-trust engagement and qualified course inquiries.',
    recommendedFunnel: ['Proof story', 'Trust-building CTA', 'Lead capture', 'Qualification', 'CRM/voice handoff'],
  },
  {
    id: 'book_app_course_bridge',
    name: 'Book/App to Course Bridge',
    useCase: 'Convert existing brand assets into course demand.',
    recommendedFor: 'Book, mobile app, newsletter, free content ecosystem',
    topic: 'Bridge book/app followers into a structured course or coaching journey.',
    objective:
      'Connect a popular free or low-cost brand asset to a deeper paid learning path with a clear CTA.',
    audience:
      'Existing followers who consume free content, book content, or app content and may be ready for structured learning.',
    cta: 'Continue the journey inside the course or request the course path.',
    contentType: 'campaign',
    riskCategory: 'low',
    targetPlatforms: ['instagram', 'linkedin', 'x'],
    mediaRequirements:
      'Asset-to-course storyline, creator video, carousel structure, and SmartLabs follow-up prompt.',
    expectedOutcome: 'Warm leads with stronger intent because they already know the brand.',
    recommendedFunnel: ['Asset story', 'Course bridge', 'Lead capture', 'SmartLabs Q&A', 'CRM follow-up'],
  },
];

export const ALGORITHM_KNOWLEDGE_SOURCES: AlgorithmKnowledgeSource[] = [
  {
    id: 'instagram-ranking-explained',
    platform: 'instagram',
    title: 'Instagram ranking and recommendations guidance',
    sourceUrl: 'https://about.instagram.com/blog/announcements/instagram-ranking-explained',
    sourceType: 'official_docs',
    status: 'requires_review',
    importedBy: 'operator_review',
    lastReviewed: '2026-06-29',
    notes:
      'Used as an official public reference for ranking signals. It is not a private or complete Instagram algorithm export.',
  },
  {
    id: 'instagram-graph-api-insights',
    platform: 'instagram',
    title: 'Instagram Graph API insights',
    sourceUrl: 'https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/',
    sourceType: 'official_docs',
    status: 'customer_data_required',
    importedBy: 'official_api',
    lastReviewed: '2026-06-29',
    notes:
      'Used for official customer-owned performance data once a business/professional Instagram account is connected.',
  },
  {
    id: 'x-recommendation-algorithm',
    platform: 'x',
    title: 'X recommendation algorithm open-source reference',
    sourceUrl: 'https://github.com/twitter/the-algorithm',
    sourceType: 'open_source_reference',
    status: 'active_reference',
    importedBy: 'operator_review',
    lastReviewed: '2026-06-29',
    notes:
      'Open-source reference only. Tanaghum still learns from customer-owned X performance data when connected.',
  },
  {
    id: 'linkedin-marketing-solutions',
    platform: 'linkedin',
    title: 'LinkedIn Marketing Solutions official guidance',
    sourceUrl: 'https://business.linkedin.com/marketing-solutions',
    sourceType: 'official_docs',
    status: 'requires_review',
    importedBy: 'operator_review',
    lastReviewed: '2026-06-29',
    notes:
      'Used as public platform guidance for professional audience fit and B2B content framing.',
  },
  {
    id: 'tanaghum-customer-performance',
    platform: 'all',
    title: 'Customer-owned post performance history',
    sourceUrl: 'tenant://analytics/social-performance',
    sourceType: 'internal_analytics',
    status: 'customer_data_required',
    importedBy: 'official_api',
    lastReviewed: '2026-06-29',
    notes:
      'Becomes the strongest signal after official social analytics and Postiz history are connected for the tenant.',
  },
];

export const ALGORITHM_GUIDANCE_RULES: AlgorithmGuidanceRule[] = [
  {
    id: 'ig-first-three-seconds',
    platform: 'instagram',
    signal: 'Opening hook',
    recommendation:
      'Lead with the pain point, promise, or surprising course outcome in the first seconds/first line.',
    businessImpact: 'Improves retention on reels and increases chance that warm followers continue to the CTA.',
    sourceId: 'instagram-ranking-explained',
    confidence: 'medium',
    canInfluenceScore: true,
  },
  {
    id: 'ig-saves-shares',
    platform: 'instagram',
    signal: 'Save/share value',
    recommendation:
      'Turn course lessons into practical checklists, frameworks, and carousel points that followers want to save.',
    businessImpact: 'Makes educational content more useful and increases qualified course interest.',
    sourceId: 'instagram-ranking-explained',
    confidence: 'medium',
    canInfluenceScore: true,
  },
  {
    id: 'linkedin-professional-outcome',
    platform: 'linkedin',
    signal: 'Professional relevance',
    recommendation:
      'Frame course content around business, leadership, or career outcomes instead of generic motivational copy.',
    businessImpact: 'Improves fit for professional buyers and decision-makers.',
    sourceId: 'linkedin-marketing-solutions',
    confidence: 'medium',
    canInfluenceScore: true,
  },
  {
    id: 'x-conversation-hook',
    platform: 'x',
    signal: 'Conversation starter',
    recommendation:
      'Use a compact, concrete thought that invites response without engagement bait or fake controversy.',
    businessImpact: 'Helps test messages quickly and discover course-market resonance.',
    sourceId: 'x-recommendation-algorithm',
    confidence: 'medium',
    canInfluenceScore: true,
  },
  {
    id: 'all-clear-course-cta',
    platform: 'all',
    signal: 'Conversion clarity',
    recommendation:
      'Every campaign needs one explicit next action: join waitlist, request link, reserve seat, or ask for details.',
    businessImpact: 'Turns attention into measurable lead capture instead of vanity engagement.',
    sourceId: 'tanaghum-customer-performance',
    confidence: 'high',
    canInfluenceScore: true,
  },
  {
    id: 'all-avoid-unsafe-claims',
    platform: 'all',
    signal: 'Compliance and trust',
    recommendation:
      'Avoid guaranteed transformation, exaggerated claims, fake urgency, and manipulative engagement tactics.',
    businessImpact: 'Protects the personal brand while preserving approval and scheduling readiness.',
    sourceId: 'tanaghum-customer-performance',
    confidence: 'high',
    canInfluenceScore: true,
  },
];
