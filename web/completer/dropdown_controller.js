import { $el } from "../../../scripts/ui.js";
import { TagCompleterSettings } from "./tag_completer_settings.js";

// ==============================================
// ドロップダウンの表示制御を担当するクラス
// ==============================================

export class DropdownController {
    constructor(textareaElement) {
        this.settings = TagCompleterSettings;

        this.textareaElement = textareaElement;
        this.dropdown = $el("div.jupo-tagcomplete");
        this.items = null;
        this.currentIndex = 0;
        this.isMousedownOnDropdown = false;
        this.isHoveringOnDropdown = false;

        this.setupDropdownMouseEvents();
    }

    // ------------------------------------------
    // ドロップダウンマウスイベントの設定
    // ------------------------------------------
    setupDropdownMouseEvents() {
        // マウスダウン時のフラグ管理
        document.addEventListener("mousedown", (e) => {
            if (this.dropdown.contains(e.target)) {
                this.isMousedownOnDropdown = true;
                this.handleScrollbarClick(e);
            } else {
                this.isMousedownOnDropdown = false;
            }
        });

        // マウスアップ時にフラグをリセット
        document.addEventListener("mouseup", () => {
            this.isMousedownOnDropdown = false;
        });

        // ドロップダウンにマウスが入ったとき
        this.dropdown.addEventListener("mouseenter", () => {
            this.isHoveringOnDropdown = true;
        });

        this.dropdown.addEventListener("mouseleave", () => {
            this.isHoveringOnDropdown = false;
        });
    }


    // ------------------------------------------
    // スクロールバークリックの検出と処理
    // ------------------------------------------
    handleScrollbarClick(e) {
        const dropdown = this.dropdown;
        const rect = dropdown.getBoundingClientRect();

        // スクロールバー領域を計算
        const scorllbarWidth = dropdown.offsetWidth - dropdown.clientWidth;
        const isScrollbarClick = e.clientX >= rect.rigth - scorllbarWidth;

        if (isScrollbarClick) {
            // スクロールバーがクリックされた場合、テキストエリアのフォーカスを維持
            e.preventDefault();
            setTimeout(() => {
                this.textareaElement.focus();
            }, 0);
        }
    }


    // ------------------------------------------
    // ドロップダウンを表示
    // ------------------------------------------
    show(items, position) {
        this.items = items;
        this.currentIndex = 0;
        this.updateDropdownContent();
        this.updateDropdownPosition(position);
        this.updateItemSelection();
    }

    // ------------------------------------------
    // ドロップダウンを非表示
    // ------------------------------------------
    hide() {
        if (!this.dropdown.parentElement) return;

        this.items = null;
        this.currentIndex = 0;
        this.isMousedownOnDropdown = false;
        this.isHoveringOnDropdown = false;
        this.dropdown.remove();
    }


    // ------------------------------------------
    // 表示状態を確認
    // ------------------------------------------
    isVisible() {
        return this.dropdown.parentElement !== null;
    }


    // ------------------------------------------
    // 現在のアイテム数を取得
    // ------------------------------------------
    getItemCount() {
        return this.items ? this.items.length : 0;
    }


    // ------------------------------------------
    // 現在のインデックスを取得
    // ------------------------------------------
    getCurrentIndex() {
        return this.currentIndex;
    }


    // ------------------------------------------
    // インデックスを設定
    // ------------------------------------------
    setCurrentIndex(index) {
        if (!this.items) return;

        this.currentIndex = Math.max(0, Math.min(index, this.items.length - 1));
        this.updateItemSelection();
    }


    // ------------------------------------------
    // 上に移動
    // ------------------------------------------
    navigateUp() {
        if (!this.items) return;

        this.currentIndex = this.currentIndex <= 0 
            ? this.items.length - 1 
            : this.currentIndex - 1;
        
        this.updateItemSelection();
    }

    // ------------------------------------------
    // 下に移動
    // ------------------------------------------
    navigateDown() {
        if (!this.items) return;

        this.currentIndex = this.currentIndex >= this.items.length - 1 
            ? 0 
            : this.currentIndex + 1;
        
        this.updateItemSelection();
    }

    
    // ------------------------------------------
    // ページ単位で移動
    // ------------------------------------------
    navigatePage(direction, pageSize) {
        if (!this.items) return;

        this.currentIndex = direction > 0 
            ? Math.min(this.items.length - 1, this.currentIndex + pageSize) 
            : Math.max(0, this.currentIndex - pageSize);
        
        this.updateItemSelection();
    }


    // ------------------------------------------
    // 選択中のアイテムを取得
    // ------------------------------------------
    getSelectedItem() {
        if (!this.items || this.currentIndex < 0 || this.currentIndex >= this.items.length) {
            return null;
        }
        return this.items[this.currentIndex];
    }


    // ------------------------------------------
    // マウス状態を確認
    // ------------------------------------------
    isMouseInteracting() {
        return this.isMousedownOnDropdown || this.isHoveringOnDropdown;
    }


    // ------------------------------------------
    // ドロップダウンの高さを取得
    // ------------------------------------------
    getDropdownHeight() {
        return this.dropdown.clientHeight;
    }


    // ------------------------------------------
    // ドロップダウンの内容を更新
    // ------------------------------------------
    updateDropdownContent() {
        if (!this.items) return;

        this.dropdown.replaceChildren(...this.items);
        this.dropdown.setAttribute("tabindex", "-1");

        if (!this.dropdown.parentElement) {
            document.body.append(this.dropdown);
        }
    }


    // ------------------------------------------
    // ドロップダウンの位置を更新
    // ------------------------------------------
    updateDropdownPosition(position) {
        if (!position) return;

        this.dropdown.style.left = `${position.left ?? 0}px`;
        this.dropdown.style.top = `${position.top ?? 0}px`;
        this.dropdown.style.maxHeight = `${window.innerHeight - position.top}px`;
    }


    // ------------------------------------------
    // アイテムの選択状態を更新
    // ------------------------------------------
    updateItemSelection() {
        if (!this.items) return;

        const selectedClassName = "jupo-tagcomplete-item--selected";

        this.items.forEach((item, index) => {
            const isSelected = this.currentIndex === index;
            item.classList.toggle(selectedClassName, isSelected);

            if (isSelected) {
                item.scrollIntoView({
                    block: "nearest", 
                    behavior: "smooth", 
                    inline: "nearest"
                });
            }
        });
    }


    // ------------------------------------------
    // クリーンアップ
    // ------------------------------------------
    destroy() {
        this.hide();
        this.isMousedownOnDropdown = false;
        this.isHoveringOnDropdown = false;
    }
}