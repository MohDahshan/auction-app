"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const banners = await (0, database_1.db)('banners')
            .select('*')
            .where('is_active', true)
            .orderBy('order_index', 'asc');
        res.json({
            success: true,
            data: banners
        });
    }
    catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch banners'
        });
    }
});
router.get('/admin', auth_1.authenticateToken, async (req, res) => {
    try {
        const banners = await (0, database_1.db)('banners')
            .select('*')
            .orderBy('order_index', 'asc');
        res.json({
            success: true,
            data: banners
        });
    }
    catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch banners'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await (0, database_1.db)('banners')
            .select('*')
            .where('id', id)
            .first();
        if (!banner) {
            res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
            return;
        }
        res.json({
            success: true,
            data: banner
        });
    }
    catch (error) {
        console.error('Error fetching banner:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch banner'
        });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { title, subtitle, description, image_url, gradient, accent, button_text, button_link, is_active, order_index } = req.body;
        if (!title || !description || !image_url) {
            res.status(400).json({
                success: false,
                error: 'Title, description, and image_url are required'
            });
            return;
        }
        let finalOrderIndex = order_index;
        if (finalOrderIndex === undefined || finalOrderIndex === null) {
            const maxOrder = await (0, database_1.db)('banners').max('order_index as max').first();
            finalOrderIndex = (maxOrder?.max || 0) + 1;
        }
        const [banner] = await (0, database_1.db)('banners')
            .insert({
            title,
            subtitle,
            description,
            image_url,
            gradient: gradient || 'from-blue-600 to-purple-700',
            accent: accent || 'text-blue-300',
            button_text: button_text || 'Start Bidding 🚀',
            button_link,
            is_active: is_active !== undefined ? is_active : true,
            order_index: finalOrderIndex
        })
            .returning('*');
        res.status(201).json({
            success: true,
            data: banner
        });
    }
    catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create banner'
        });
    }
});
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, description, image_url, gradient, accent, button_text, button_link, is_active, order_index } = req.body;
        const existingBanner = await (0, database_1.db)('banners').where('id', id).first();
        if (!existingBanner) {
            res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
            return;
        }
        const updateData = {};
        if (title !== undefined)
            updateData.title = title;
        if (subtitle !== undefined)
            updateData.subtitle = subtitle;
        if (description !== undefined)
            updateData.description = description;
        if (image_url !== undefined)
            updateData.image_url = image_url;
        if (gradient !== undefined)
            updateData.gradient = gradient;
        if (accent !== undefined)
            updateData.accent = accent;
        if (button_text !== undefined)
            updateData.button_text = button_text;
        if (button_link !== undefined)
            updateData.button_link = button_link;
        if (is_active !== undefined)
            updateData.is_active = is_active;
        if (order_index !== undefined)
            updateData.order_index = order_index;
        updateData.updated_at = new Date();
        const [banner] = await (0, database_1.db)('banners')
            .where('id', id)
            .update(updateData)
            .returning('*');
        res.json({
            success: true,
            data: banner
        });
    }
    catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update banner'
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const existingBanner = await (0, database_1.db)('banners').where('id', id).first();
        if (!existingBanner) {
            res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
            return;
        }
        await (0, database_1.db)('banners').where('id', id).del();
        res.json({
            success: true,
            message: 'Banner deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete banner'
        });
    }
});
router.patch('/:id/toggle', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const existingBanner = await (0, database_1.db)('banners').where('id', id).first();
        if (!existingBanner) {
            res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
            return;
        }
        const [banner] = await (0, database_1.db)('banners')
            .where('id', id)
            .update({
            is_active: !existingBanner.is_active,
            updated_at: new Date()
        })
            .returning('*');
        res.json({
            success: true,
            data: banner
        });
    }
    catch (error) {
        console.error('Error toggling banner status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle banner status'
        });
    }
});
router.post('/reorder', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bannerIds } = req.body;
        if (!Array.isArray(bannerIds)) {
            res.status(400).json({
                success: false,
                error: 'bannerIds must be an array'
            });
            return;
        }
        const updatePromises = bannerIds.map((bannerId, index) => (0, database_1.db)('banners')
            .where('id', bannerId)
            .update({
            order_index: index,
            updated_at: new Date()
        }));
        await Promise.all(updatePromises);
        const banners = await (0, database_1.db)('banners')
            .select('*')
            .orderBy('order_index', 'asc');
        res.json({
            success: true,
            data: banners
        });
    }
    catch (error) {
        console.error('Error reordering banners:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reorder banners'
        });
    }
});
exports.default = router;
//# sourceMappingURL=banners.js.map