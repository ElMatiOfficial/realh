import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { DEMO_MODE, mockDb, db } from '../lib/firebase';

export default function AssetRegistry({ user, userData }) {
    const [assets, setAssets] = useState([]);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        if (DEMO_MODE) {
            setAssets(mockDb.assets.filter(a => a.ownerId === user.uid));
            return;
        }
        const q = query(collection(db, "assets"), where("ownerId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        setAssets(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const handleCreate = async (assetData) => {
        const newAsset = {
            ownerId: user.uid,
            ...assetData,
            createdAt: new Date().toISOString()
        };

        if (DEMO_MODE) {
            mockDb.assets.push({ id: 'asset_' + Date.now(), ...newAsset });
        } else {
            await addDoc(collection(db, "assets"), newAsset);
        }
        setShowForm(false);
        fetchAssets();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Creative Patent Registry</h2>
                    <p className="text-slate-400">Immutable proof of human creation.</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    disabled={!userData?.isVerified}
                    className="px-4 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Register New Asset
                </button>
            </div>

            {!userData?.isVerified && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    Verification required to register assets.
                </div>
            )}

            {showForm && (
                <AssetForm onClose={() => setShowForm(false)} onSubmit={handleCreate} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assets.map(asset => (
                    <AssetCard key={asset.id} asset={asset} ownerName={userData?.email} />
                ))}
                {assets.length === 0 && !showForm && (
                    <div className="col-span-2 py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                        No assets registered yet.
                    </div>
                )}
            </div>
        </div>
    );
}

function AssetForm({ onClose, onSubmit }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [hash, setHash] = useState('');
    const [calculating, setCalculating] = useState(false);

    const generateHash = () => {
        if (!title || !content) return;
        setCalculating(true);
        setTimeout(() => {
            // Simple mock hash for visual purposes
            const mockHash = Array.from(title + content).reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16)
                + 'x' + Math.random().toString(36).substring(2);
            setHash('SHA256-' + mockHash.toUpperCase().padEnd(64, '0'));
            setCalculating(false);
        }, 1500);
    };

    return (
        <div className="glass-panel p-6 rounded-2xl border-human-neon/20 mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-lg font-bold text-white mb-4">Register New Asset</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Asset Title</label>
                    <input
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none"
                        value={title} onChange={e => setTitle(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Content / Description</label>
                    <textarea
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none h-24"
                        value={content} onChange={e => setContent(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={generateHash}
                        disabled={!title || !content}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Hash'}
                    </button>
                    {hash && <div className="font-mono text-xs text-human-neon break-all">{hash}</div>}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button
                        onClick={() => onSubmit({ title, description: content, hash, type: 'text' })}
                        disabled={!hash}
                        className="px-6 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50"
                    >
                        Mint Certificate
                    </button>
                </div>
            </div>
        </div>
    );
}

function AssetCard({ asset, ownerName }) {
    return (
        <div className="glass-card p-0 rounded-xl overflow-hidden group relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-human-neon to-transparent" />
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/10">
                        <FileText className="w-6 h-6 text-human-neon" />
                    </div>
                    <div className="text-xs font-mono text-slate-500">{new Date(asset.createdAt).toLocaleDateString()}</div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{asset.title}</h3>
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{asset.description}</p>

                <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Asset Hash</div>
                    <div className="font-mono text-xs text-human-neon truncate">{asset.hash}</div>
                </div>
            </div>

            {/* Certificate Overlay Effect */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center backdrop-blur-[1px]">
                <div className="border-2 border-human-neon/50 px-4 py-2 rounded text-human-neon font-bold tracking-widest transform -rotate-12">
                    HUMAN CERTIFIED
                </div>
            </div>
        </div>
    );
}
