import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { Badge } from '../components/ExecutiveUI';

interface PostIdea {
  id: string;
  title: string;
  hook: string;
  platform: string;
  format: string;
  hashtags: string[];
  estimatedReach: string;
  rationale: string;
}

export default function PostIdeas() {
  const { token } = useAuth();
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['linkedin']);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedIdea, setSelectedIdea] = useState<PostIdea | null>(null);

  const generateIdeas = async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal, audience, platforms, count: 3 }),
      });
      const data = await res.json();
      setIdeas(data.ideas || []);
      setMessage(`Generated ${data.ideas?.length || 0} ideas using ${data.provider || 'AI'}`);
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setLoading(false);
  };

  const convertToCampaign = async (idea: PostIdea) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/ideas/convert-to-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idea, platforms: [idea.platform] }),
      });
      const data = await res.json();
      setMessage(`Campaign created: ${data.title}`);
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Post Ideas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Generate social media post ideas powered by AI</p>
        </div>
        <Badge variant="info">AI-Powered</Badge>
      </div>

      {/* Input Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">What do you want to achieve?</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Business Goal / Campaign Objective</label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g., Increase brand awareness for our wellness course, promote new product launch..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 h-24"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Target Audience</label>
            <input
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="e.g., Health-conscious professionals aged 25-45"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Platforms</label>
            <div className="flex gap-3">
              {['linkedin', 'instagram', 'twitter'].map(p => (
                <button
                  key={p}
                  onClick={() => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${platforms.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={generateIdeas}
            disabled={loading || !goal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Generating...' : 'Generate Post Ideas'}
          </button>
        </div>
      </div>

      {message && <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-2 text-sm">{message}</div>}

      {/* Generated Ideas */}
      {ideas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Generated Ideas</h2>
          {ideas.map(idea => (
            <div
              key={idea.id}
              className={`bg-gray-900 border rounded-xl p-5 cursor-pointer transition-all ${selectedIdea?.id === idea.id ? 'border-blue-500' : 'border-gray-800 hover:border-gray-700'}`}
              onClick={() => setSelectedIdea(idea)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white">{idea.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">{idea.hook}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info">{idea.platform}</Badge>
                  <Badge variant={idea.estimatedReach === 'high' ? 'success' : idea.estimatedReach === 'medium' ? 'warning' : 'default'}>
                    {idea.estimatedReach} reach
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-gray-500">Format: <span className="text-gray-300">{idea.format}</span></span>
                <span className="text-gray-500">Hashtags: <span className="text-gray-300">{idea.hashtags.join(' ')}</span></span>
              </div>
              <div className="mt-3 text-xs text-gray-500">{idea.rationale}</div>
              <div className="mt-4">
                <button
                  onClick={e => { e.stopPropagation(); convertToCampaign(idea); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Convert to Campaign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
