const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'views', 'courrier-sortant', 'Importation.vue');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the onFileSelected method
const oldMethod = `    async onFileSelected(e) {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext !== 'docx') {
        this.errorMessage = 'Format invalide. Utilisez uniquement .docx.';
        e.target.value = '';
        return;
      }

      this.fileName = file.name;
      this.loading = true;

      const form = new FormData();
      form.append('file', file);

      try {
        const res = await axios.post('http://localhost:3000/api/courriers-sortants/import', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: \`Bearer \${localStorage.getItem('token')}\`,
          },
        });
        this.errorMessage = '';
        this.toast('Document importé avec succès.', 'Succès');
        this.fileName = '';
        e.target.value = '';
        await this.fetchItems();
      } catch (err) {
        console.error('Erreur lors de l'importation :', err);
        this.errorMessage = "Erreur lors de l'importation du document.";
      } finally {
        this.loading = false;
      }
    },`;

const newMethod = `    onFileSelected(e) {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext !== 'docx') {
        this.errorMessage = 'Format invalide. Utilisez uniquement .docx.';
        e.target.value = '';
        this.selectedFile = null;
        this.fileName = '';
        return;
      }

      this.selectedFile = file;
      this.fileName = file.name;
      this.errorMessage = '';
    },

    async importDocument() {
      if (!this.canImport) return;

      this.loading = true;

      const form = new FormData();
      form.append('file', this.selectedFile);
      form.append('destinataire', this.formData.destinataire);
      form.append('objet', this.formData.objet);
      form.append('date_edition', this.formData.date_edition);

      try {
        await axios.post('http://localhost:3000/api/courriers-sortants/import', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: \`Bearer \${localStorage.getItem('token')}\`,
          },
        });
        this.errorMessage = '';
        this.toast('Document importé avec succès.', 'Succès');
        
        // Reset form
        this.formData.destinataire = '';
        this.formData.objet = '';
        this.formData.date_edition = new Date().toISOString().split('T')[0];
        this.selectedFile = null;
        this.fileName = '';
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        
        await this.fetchItems();
      } catch (err) {
        console.error('Erreur lors de l'importation :', err);
        this.errorMessage = "Erreur lors de l'importation du document.";
      } finally {
        this.loading = false;
      }
    },`;

if (content.includes(oldMethod)) {
  content = content.replace(oldMethod, newMethod);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Frontend updated successfully!');
} else {
  console.log('❌ Could not find the method to replace');
}
