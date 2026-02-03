import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Category } from '../../types';
import {
  createCategory,
  deleteCategory,
  updateCategory,
  getAssetCountByField,
  reassignAssetsAndDeleteCategory,
} from '../../supabaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AddIcon, DeleteIcon, EditIcon, InfoIcon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useSupabaseContext } from '../../SupabaseContext';
import { Modal } from '../ui/Modal';
import { IconPicker } from '../ui/IconPicker';
import { ReassignDialog } from '../ui/ReassignDialog';
import { Select } from '../ui/Select';

const CategoryItem: React.FC<{
    category: Category;
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
    isChild?: boolean;
}> = ({ category, onEdit, onDelete, isChild = false }) => (
    <div
        className={`bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow ${isChild ? 'mr-8 border-r-4 border-indigo-200' : 'border-gray-200'}`}
    >
        <div className="flex items-center">
            {category.icon ? (
                <div
                    className="w-8 h-8 ml-3 text-indigo-600 flex-shrink-0 flex items-center justify-center text-2xl"
                    title={category.name}
                >
                    <i className={category.icon}></i>
                </div>
            ) : (
                <div className="w-8 h-8 ml-3 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-sm flex-shrink-0">
                    <i className="fas fa-tag"></i>
                </div>
            )}
            <span className="text-lg font-medium text-gray-800">{category.name}</span>
        </div>
        <div className="flex space-x-2 space-x-reverse">
            <Button variant="secondary" size="sm" onClick={() => onEdit(category)} title="ویرایش">
                <EditIcon />
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(category)} title="حذف">
                <DeleteIcon />
            </Button>
        </div>
    </div>
);


export const CategoryManagement: React.FC = () => {
  const { categories, refreshCategories, isLoading: isContextLoading } = useSupabaseContext();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryIcon, setCategoryIcon] = useState<string>('');
  const [itemType, setItemType] = useState<'parent' | 'child'>('parent');
  const [parentId, setParentId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [categoryToReassign, setCategoryToReassign] = useState<Category | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [isReassigning, setIsReassigning] = useState(false);

  useEffect(() => {
    if (!isContextLoading) {
      setIsLoading(false);
    }
  }, [isContextLoading]);

  const handleOpenCreate = () => {
    setCurrentCategory(null);
    setCategoryName('');
    setCategoryIcon('');
    setItemType('parent');
    setParentId(null);
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setCurrentCategory(category);
    setCategoryName(category.name);
    setCategoryIcon(category.icon || '');
    setItemType(category.parent_id ? 'child' : 'parent');
    setParentId(category.parent_id);
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    if (!categoryName.trim()) {
      setValidationError('نام دسته بندی نمی‌تواند خالی باشد.');
      return;
    }
    
    if (itemType === 'child' && !parentId) {
        setValidationError('لطفا یک دسته بندی والد انتخاب کنید.');
        return;
    }
    
    if (currentCategory && currentCategory.id === parentId) {
        setValidationError('یک دسته بندی نمیتواند والد خودش باشد.');
        return;
    }

    const isDuplicate = categories.some(
      (c) =>
        c.name.toLowerCase() === categoryName.trim().toLowerCase() &&
        (c.parent_id || null) === (itemType === 'child' ? parentId : null) &&
        c.id !== currentCategory?.id,
    );
    if (isDuplicate) {
      setValidationError('این نام در این سطح از دسته بندی قبلاً وجود دارد.');
      return;
    }

    setIsSaving(true);
    const finalParentId = itemType === 'child' ? parentId : null;
    try {
      if (currentCategory) {
        await updateCategory(currentCategory.id, categoryName.trim(), categoryIcon || null, finalParentId);
        alert('دسته بندی با موفقیت ویرایش شد.');
      } else {
        await createCategory(categoryName.trim(), categoryIcon || null, finalParentId);
        alert('دسته بندی با موفقیت ایجاد شد.');
      }
      refreshCategories();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(`خطا در ذخیره دسته بندی: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (category: Category) => {
    setError(null);
    // Prevent deleting a category that has sub-categories
    const hasChildren = categories.some(c => c.parent_id === category.id);
    if (hasChildren) {
      alert('این دسته بندی دارای زیرمجموعه است. ابتدا باید زیرمجموعه ها را حذف یا منتقل کنید.');
      return;
    }

    try {
      const count = await getAssetCountByField('category_id', category.id);
      if (count > 0) {
        setAssetCount(count);
        setCategoryToReassign(category);
        setIsReassignModalOpen(true);
      } else {
        setCategoryToDelete(category);
        setConfirmDeleteOpen(true);
      }
    } catch (err: any) {
      const errorMessage = `خطا در بررسی تجهیزات مرتبط: ${err.message}`;
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCategory(categoryToDelete.id);
      alert('دسته بندی با موفقیت حذف شد.');
      refreshCategories();
      setConfirmDeleteOpen(false);
    } catch (err: any) {
      const errorMessage = `خطا در حذف دسته بندی: ${err.message}`;
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
      setCategoryToDelete(null);
    }
  };

  const handleConfirmReassignAndDelete = async (newCategoryId: string) => {
    if (!categoryToReassign) return;
    setIsReassigning(true);
    setError(null);
    try {
      await reassignAssetsAndDeleteCategory(categoryToReassign.id, newCategoryId);
      alert('تجهیزات با موفقیت منتقل و دسته بندی حذف شد.');
      refreshCategories();
      setIsReassignModalOpen(false);
    } catch (err: any) {
      const errorMessage = `خطا در انتقال و حذف: ${err.message}`;
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsReassigning(false);
      setCategoryToReassign(null);
    }
  };

  const parentCategories = useMemo(() => categories.filter(c => !c.parent_id).sort((a,b) => a.name.localeCompare(b.name)), [categories]);
  
  const hierarchicalCategories = useMemo(() => {
    return parentCategories
    .map(parent => ({
        ...parent,
        children: categories.filter(child => child.parent_id === parent.id).sort((a,b) => a.name.localeCompare(b.name))
    }));
  }, [categories, parentCategories]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4 bg-red-100 rounded-lg">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">مدیریت دسته بندی‌ها</h2>
        <Button variant="primary" onClick={handleOpenCreate}>
          <AddIcon className="ml-2" /> افزودن دسته بندی جدید
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="flex items-center text-gray-600 p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <InfoIcon className="fa-lg ml-3 text-blue-500" />
          <span>هنوز هیچ دسته بندی ثبت نشده است.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {hierarchicalCategories.map((parent) => (
            <div key={parent.id} className="bg-gray-50 p-4 rounded-lg">
                <CategoryItem
                    category={parent}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteClick}
                />
                {parent.children.length > 0 && (
                    <div className="mt-2 space-y-2">
                        {parent.children.map(child => (
                           <CategoryItem
                                key={child.id}
                                category={child}
                                onEdit={handleOpenEdit}
                                onDelete={handleDeleteClick}
                                isChild={true}
                            /> 
                        ))}
                    </div>
                )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentCategory ? 'ویرایش دسته بندی' : 'افزودن دسته بندی'}>
        <form onSubmit={handleSaveCategory} className="space-y-4 p-4">
          <div className="flex items-center space-x-4 space-x-reverse">
            <label className="flex items-center">
              <input type="radio" name="itemType" value="parent" checked={itemType === 'parent'} onChange={() => setItemType('parent')} className="ml-2" />
              دسته اصلی
            </label>
            <label className="flex items-center">
              <input type="radio" name="itemType" value="child" checked={itemType === 'child'} onChange={() => setItemType('child')} className="ml-2" />
              زیرمجموعه
            </label>
          </div>
          {itemType === 'child' && (
            <Select
                label="انتخاب دسته بندی والد"
                options={parentCategories.map(p => ({ value: p.id, label: p.name }))}
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value)}
                fullWidth
            />
          )}
          <Input
            label="نام دسته بندی"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            error={validationError}
            fullWidth
          />
          <div>
            <label htmlFor="icon-picker" className="block text-sm font-medium text-gray-700 mb-2">
              آیکن
            </label>
            <IconPicker value={categoryIcon} onSelect={setCategoryIcon} />
          </div>
          <div className="flex justify-start space-x-4 space-x-reverse pt-4 border-t border-gray-200">
            <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'ذخیره'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              لغو
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="حذف دسته بندی"
        message={`آیا از حذف دسته بندی "${categoryToDelete?.name}" مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        isConfirming={isDeleting}
      />

      <ReassignDialog
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        onConfirm={handleConfirmReassignAndDelete}
        title="حذف دسته بندی و انتقال تجهیزات"
        message={`دسته بندی "${categoryToReassign?.name}" دارای ${assetCount} تجهیز است. برای حذف، لطفاً یک دسته بندی جایگزین برای انتقال تجهیزات انتخاب کنید.`}
        options={categories
            .filter((c) => c.id !== categoryToReassign?.id)
            .map((c) => ({ value: c.id, label: `${c.name} ${c.parent_id ? '(زیرمجموعه)' : ''}` }))}
        isConfirming={isReassigning}
      />
    </div>
  );
};