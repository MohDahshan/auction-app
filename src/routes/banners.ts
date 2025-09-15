import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { auth } from '../middleware/auth';

const router = Router();

// Get all banners (public endpoint)
router.get('/', async (req: Request, res: Response) => {
  try {
    const banners = await db('banners')
      .select('*')
      .where('is_active', true)
      .orderBy('order_index', 'asc');

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch banners'
    });
  }
});

// Get all banners for admin (including inactive)
router.get('/admin', auth, async (req: Request, res: Response) => {
  try {
    const banners = await db('banners')
      .select('*')
      .orderBy('order_index', 'asc');

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch banners'
    });
  }
});

// Get single banner
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const banner = await db('banners')
      .select('*')
      .where('id', id)
      .first();

    if (!banner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    res.json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch banner'
    });
  }
});

// Create new banner (admin only)
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const {
      title,
      subtitle,
      description,
      image_url,
      gradient,
      accent,
      button_text,
      button_link,
      is_active,
      order_index
    } = req.body;

    // Validation
    if (!title || !description || !image_url) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and image_url are required'
      });
    }

    // Get next order_index if not provided
    let finalOrderIndex = order_index;
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const maxOrder = await db('banners').max('order_index as max').first();
      finalOrderIndex = (maxOrder?.max || 0) + 1;
    }

    const [banner] = await db('banners')
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
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create banner'
    });
  }
});

// Update banner (admin only)
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      description,
      image_url,
      gradient,
      accent,
      button_text,
      button_link,
      is_active,
      order_index
    } = req.body;

    // Check if banner exists
    const existingBanner = await db('banners').where('id', id).first();
    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (gradient !== undefined) updateData.gradient = gradient;
    if (accent !== undefined) updateData.accent = accent;
    if (button_text !== undefined) updateData.button_text = button_text;
    if (button_link !== undefined) updateData.button_link = button_link;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (order_index !== undefined) updateData.order_index = order_index;

    updateData.updated_at = new Date();

    const [banner] = await db('banners')
      .where('id', id)
      .update(updateData)
      .returning('*');

    res.json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update banner'
    });
  }
});

// Delete banner (admin only)
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if banner exists
    const existingBanner = await db('banners').where('id', id).first();
    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    await db('banners').where('id', id).del();

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete banner'
    });
  }
});

// Toggle banner active status (admin only)
router.patch('/:id/toggle', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if banner exists
    const existingBanner = await db('banners').where('id', id).first();
    if (!existingBanner) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }

    const [banner] = await db('banners')
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
  } catch (error) {
    console.error('Error toggling banner status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle banner status'
    });
  }
});

// Reorder banners (admin only)
router.post('/reorder', auth, async (req: Request, res: Response) => {
  try {
    const { bannerIds } = req.body; // Array of banner IDs in new order

    if (!Array.isArray(bannerIds)) {
      return res.status(400).json({
        success: false,
        error: 'bannerIds must be an array'
      });
    }

    // Update order_index for each banner
    const updatePromises = bannerIds.map((bannerId, index) =>
      db('banners')
        .where('id', bannerId)
        .update({
          order_index: index,
          updated_at: new Date()
        })
    );

    await Promise.all(updatePromises);

    // Fetch updated banners
    const banners = await db('banners')
      .select('*')
      .orderBy('order_index', 'asc');

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('Error reordering banners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder banners'
    });
  }
});

export default router;
